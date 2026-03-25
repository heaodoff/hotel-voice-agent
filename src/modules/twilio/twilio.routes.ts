import type { FastifyInstance, FastifyRequest } from 'fastify';
import type WebSocket from 'ws';
import { generateStreamTwiml, transferCall, startCallRecording } from './twilio.service.js';
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

const logger = createChildLogger({ module: 'twilio-routes' });

export async function twilioRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /twilio/voice — Incoming call webhook.
   * Twilio calls this when a call comes in to our number.
   * Responds with TwiML that connects the call to a media stream.
   */
  fastify.post('/twilio/voice', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const callSid = body['CallSid'] ?? '';
    const callerNumber = body['From'] ?? '';
    const calledNumber = body['To'] ?? '';

    logger.info({ callSid, from: callerNumber, to: calledNumber }, 'Incoming call');

    // Route by called number → find hotel
    const env = getEnv();
    let hotelId = env.DEFAULT_HOTEL_ID;

    const hotel = await findHotelByPhone(fastify.prisma, calledNumber);
    if (hotel) {
      hotelId = hotel.id;
      logger.info({ callSid, hotelId, hotelName: hotel.name }, 'Routed to hotel');
    } else {
      logger.warn({ callSid, calledNumber }, 'No hotel found for number, using default');
    }

    // Record the call with hotel
    try {
      await createCall(fastify.prisma, {
        twilioCallSid: callSid,
        callerNumber,
        hotelId,
      });
    } catch (err) {
      logger.error({ err, callSid }, 'Failed to create call record');
    }

    // Respond with TwiML that opens a media stream
    const twiml = generateStreamTwiml(callSid);

    reply.type('text/xml');
    return reply.send(twiml);
  });

  /**
   * POST /twilio/status — Call status callback.
   * Twilio calls this when the call status changes (ringing, in-progress, completed, etc.)
   */
  fastify.post('/twilio/status', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const callSid = body['CallSid'] ?? '';
    const callStatus = body['CallStatus'] ?? '';
    const duration = body['CallDuration'];

    logger.info({ callSid, status: callStatus, duration }, 'Call status update');

    const statusMap: Record<string, 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER'> = {
      ringing: 'RINGING',
      'in-progress': 'IN_PROGRESS',
      completed: 'COMPLETED',
      failed: 'FAILED',
      busy: 'FAILED',
      'no-answer': 'NO_ANSWER',
      canceled: 'FAILED',
    };

    const mappedStatus = statusMap[callStatus];
    if (mappedStatus) {
      try {
        await updateCallStatus(fastify.prisma, callSid, mappedStatus, {
          duration: duration ? parseInt(duration, 10) : undefined,
        });
      } catch (err) {
        logger.error({ err, callSid }, 'Failed to update call status');
      }
    }

    if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'canceled') {
      // Save transcript before closing session
      try {
        await saveCallTranscript(fastify.prisma, callSid);
      } catch (err) {
        logger.warn({ err, callSid }, 'Failed to save transcript on call end');
      }
      closeRealtimeSession(callSid);
    }

    return reply.send({ ok: true });
  });

  /**
   * POST /twilio/recording — Recording status callback.
   * Twilio calls this when a recording is available.
   */
  fastify.post('/twilio/recording', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const callSid = body['CallSid'] ?? '';
    const recordingUrl = body['RecordingUrl'] ?? '';
    const recordingSid = body['RecordingSid'] ?? '';

    logger.info({ callSid, recordingSid }, 'Recording available');

    if (callSid && recordingUrl) {
      try {
        await fastify.prisma.call.update({
          where: { twilioCallSid: callSid },
          data: { recordingUrl, recordingSid },
        });
      } catch (err) {
        logger.warn({ err, callSid }, 'Failed to save recording URL');
      }
    }

    return reply.send({ ok: true });
  });

  /**
   * WebSocket /ws/media-stream — Twilio media stream endpoint.
   * Bidirectional audio: Twilio sends caller audio, we send AI audio back.
   */
  fastify.get('/ws/media-stream', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    logger.info('Media stream WebSocket connected');

    let callSid: string | null = null;
    let streamSid: string | null = null;

    socket.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          event: string;
          start?: { callSid: string; streamSid: string; customParameters?: Record<string, string> };
          media?: { payload: string };
          stop?: { callSid: string };
          streamSid?: string;
        };

        switch (msg.event) {
          case 'connected':
            logger.info('Media stream connected event');
            break;

          case 'start': {
            callSid = msg.start?.callSid ?? msg.start?.customParameters?.['callSid'] ?? null;
            streamSid = msg.start?.streamSid ?? null;
            logger.info({ callSid, streamSid }, 'Media stream started');

            if (callSid) {
              // Find the internal call ID — hotelId already set during /twilio/voice routing
              const call = await fastify.prisma.call.findUnique({
                where: { twilioCallSid: callSid },
              });

              if (call) {
                // Create OpenAI Realtime session with hotel from call record
                const session = await createRealtimeSession(
                  fastify.prisma,
                  callSid,
                  call.id,
                  call.hotelId,
                  call.callerNumber,
                );

                // Listen for audio from OpenAI to send back to Twilio
                session.ws.on('message', (aiData) => {
                  try {
                    const aiEvent = JSON.parse(aiData.toString()) as {
                      type: string;
                      delta?: string;
                    };

                    if (aiEvent.type === 'response.audio.delta' && aiEvent.delta && streamSid) {
                      // Forward AI audio to Twilio
                      socket.send(JSON.stringify({
                        event: 'media',
                        streamSid,
                        media: { payload: aiEvent.delta },
                      }));
                    }
                  } catch {
                    // Ignore parse errors on AI events
                  }
                });

                await updateCallStatus(fastify.prisma, callSid, 'IN_PROGRESS');

                // Start call recording via REST API (non-blocking)
                startCallRecording(callSid);
              }
            }
            break;
          }

          case 'media': {
            // Forward caller audio to OpenAI Realtime
            if (callSid && msg.media?.payload) {
              sendAudioToRealtime(callSid, msg.media.payload);
            }
            break;
          }

          case 'stop': {
            logger.info({ callSid, streamSid }, 'Media stream stopped');
            if (callSid) {
              closeRealtimeSession(callSid);
            }
            break;
          }

          default:
            logger.trace({ event: msg.event }, 'Unhandled media stream event');
        }
      } catch (err) {
        logger.error({ err }, 'Error processing media stream message');
      }
    });

    socket.on('close', () => {
      logger.info({ callSid, streamSid }, 'Media stream WebSocket closed');
      if (callSid) {
        closeRealtimeSession(callSid);
      }
    });

    socket.on('error', (err) => {
      logger.error({ err, callSid }, 'Media stream WebSocket error');
    });
  });
}
