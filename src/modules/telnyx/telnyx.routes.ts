import type { FastifyInstance, FastifyRequest } from 'fastify';
import type WebSocket from 'ws';
import { answerCall, startStreaming } from './telnyx.service.js';
import { createCall, updateCallStatus } from '../calls/index.js';
import {
  createRealtimeSession,
  sendAudioToRealtime,
  getRealtimeSession,
  closeRealtimeSession,
  saveCallTranscript,
} from '../ai/index.js';
import { getEnv } from '../../config/index.js';
import { createChildLogger } from '../../lib/logger.js';
import { findHotelByPhone } from '../hotels/index.js';

const logger = createChildLogger({ module: 'telnyx-routes' });

interface TelnyxWebhookBody {
  data: {
    event_type: string;
    payload: {
      call_control_id: string;
      call_leg_id: string;
      call_session_id: string;
      from: string;
      to: string;
      direction: string;
      state: string;
      stream_url?: string;
    };
  };
}

export async function telnyxRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /telnyx/voice — Telnyx Call Control webhook.
   * Handles all call events: initiated, answered, streaming, hangup.
   */
  fastify.post('/telnyx/voice', async (request, reply) => {
    const body = request.body as TelnyxWebhookBody;
    const eventType = body.data?.event_type;
    const payload = body.data?.payload;

    if (!eventType || !payload) {
      logger.warn({ body }, 'Invalid Telnyx webhook payload');
      return reply.send({ ok: true });
    }

    const callControlId = payload.call_control_id;
    const from = payload.from ?? '';
    const to = payload.to ?? '';

    logger.info({ eventType, callControlId, from, to }, 'Telnyx webhook');

    switch (eventType) {
      case 'call.initiated': {
        if (payload.direction !== 'incoming') break;

        // Route by called number → find hotel
        const env = getEnv();
        let hotelId = env.DEFAULT_HOTEL_ID;

        const hotel = await findHotelByPhone(fastify.prisma, to);
        if (hotel) {
          hotelId = hotel.id;
          logger.info({ callControlId, hotelId, hotelName: hotel.name }, 'Routed to hotel');
        }

        // Record the call (use call_control_id as our "callSid" equivalent)
        try {
          await createCall(fastify.prisma, {
            twilioCallSid: callControlId, // reuse field for Telnyx call ID
            callerNumber: from,
            hotelId,
          });
        } catch (err) {
          logger.error({ err, callControlId }, 'Failed to create call record');
        }

        // Answer the call
        try {
          await answerCall(callControlId);
          logger.info({ callControlId }, 'Call answered');
        } catch (err) {
          logger.error({ err, callControlId }, 'Failed to answer call');
        }
        break;
      }

      case 'call.answered': {
        // Start media streaming to our WebSocket endpoint
        const env = getEnv();
        const wsUrl = env.TWILIO_WEBHOOK_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
        const streamUrl = `${wsUrl}/ws/telnyx-stream?call_control_id=${callControlId}`;

        try {
          await startStreaming(callControlId, streamUrl);
          logger.info({ callControlId, streamUrl }, 'Streaming started');
        } catch (err) {
          logger.error({ err, callControlId }, 'Failed to start streaming');
        }
        break;
      }

      case 'streaming.started': {
        logger.info({ callControlId }, 'Telnyx streaming confirmed');
        break;
      }

      case 'streaming.stopped': {
        logger.info({ callControlId }, 'Telnyx streaming stopped');
        break;
      }

      case 'call.hangup': {
        logger.info({ callControlId }, 'Call hung up');
        try {
          await saveCallTranscript(fastify.prisma, callControlId);
        } catch (err) {
          logger.warn({ err, callControlId }, 'Failed to save transcript');
        }
        try {
          await updateCallStatus(fastify.prisma, callControlId, 'COMPLETED');
        } catch (err) {
          logger.warn({ err, callControlId }, 'Failed to update call status');
        }
        closeRealtimeSession(callControlId);
        break;
      }

      default:
        logger.debug({ eventType, callControlId }, 'Unhandled Telnyx event');
    }

    return reply.send({ ok: true });
  });

  /**
   * WebSocket /ws/telnyx-stream — Telnyx media stream endpoint.
   * Bidirectional audio: Telnyx sends caller audio, we send AI audio back.
   * Protocol is nearly identical to Twilio's media stream.
   */
  fastify.get('/ws/telnyx-stream', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    logger.info('Telnyx media stream WebSocket connected');

    // Extract call_control_id from query params
    const url = new URL(request.url, 'http://localhost');
    let callControlId: string | null = url.searchParams.get('call_control_id');
    let streamId: string | null = null;

    socket.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          event: string;
          stream_id?: string;
          start?: {
            call_control_id: string;
            media_format: { encoding: string; sample_rate: number; channels: number };
          };
          media?: { track: string; chunk: string; timestamp: string; payload: string };
          stop?: { call_control_id: string };
        };

        switch (msg.event) {
          case 'start': {
            callControlId = msg.start?.call_control_id ?? callControlId;
            streamId = msg.stream_id ?? null;
            const format = msg.start?.media_format;
            logger.info({ callControlId, streamId, format }, 'Telnyx stream started');

            if (callControlId) {
              const call = await fastify.prisma.call.findUnique({
                where: { twilioCallSid: callControlId },
              });

              if (call) {
                const session = await createRealtimeSession(
                  fastify.prisma,
                  callControlId,
                  call.id,
                  call.hotelId,
                  call.callerNumber,
                );

                // Forward OpenAI audio back to Telnyx
                session.ws.on('message', (aiData) => {
                  try {
                    const aiEvent = JSON.parse(aiData.toString()) as {
                      type: string;
                      delta?: string;
                    };

                    if (aiEvent.type === 'response.audio.delta' && aiEvent.delta) {
                      // Telnyx format: no streamSid needed (unlike Twilio)
                      socket.send(JSON.stringify({
                        event: 'media',
                        media: { payload: aiEvent.delta },
                      }));
                    }
                  } catch {
                    // Ignore parse errors
                  }
                });

                await updateCallStatus(fastify.prisma, callControlId, 'IN_PROGRESS');
              }
            }
            break;
          }

          case 'media': {
            // Forward caller audio to OpenAI Realtime
            if (callControlId && msg.media?.payload) {
              sendAudioToRealtime(callControlId, msg.media.payload);
            }
            break;
          }

          case 'stop': {
            logger.info({ callControlId, streamId }, 'Telnyx stream stopped');
            if (callControlId) {
              closeRealtimeSession(callControlId);
            }
            break;
          }

          default:
            logger.trace({ event: msg.event }, 'Unhandled Telnyx stream event');
        }
      } catch (err) {
        logger.error({ err }, 'Error processing Telnyx stream message');
      }
    });

    socket.on('close', () => {
      logger.info({ callControlId, streamId }, 'Telnyx stream WebSocket closed');
      if (callControlId) {
        closeRealtimeSession(callControlId);
      }
    });

    socket.on('error', (err) => {
      logger.error({ err, callControlId }, 'Telnyx stream WebSocket error');
    });
  });
}
