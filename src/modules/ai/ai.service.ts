import WebSocket from 'ws';
import type { PrismaClient } from '@prisma/client';
import { getEnv } from '../../config/index.js';
import { createChildLogger } from '../../lib/logger.js';
import { updateCallSession, getCallSession } from '../../lib/redis.js';
import { getSystemPrompt } from './ai.prompt.js';
import { toolDefinitions, createToolHandlers } from './ai.tools.js';
import { getGuestContext } from '../calls/calls.service.js';
import { getHotelConfig, type HotelConfig } from '../hotels/index.js';

const logger = createChildLogger({ module: 'ai-service' });

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

interface RealtimeSession {
  ws: WebSocket;
  callSid: string;
  callId: string;
  toolHandlers: Record<string, (args: unknown) => Promise<unknown>>;
  transcript: TranscriptEntry[];
  responseTimer: ReturnType<typeof setTimeout> | null;
  responseTimeoutTimer: ReturnType<typeof setTimeout> | null;
  sessionConfigured: boolean;
  hotelConfig: HotelConfig | null;
  isResponseActive: boolean;
}

// Active sessions indexed by callSid
const activeSessions = new Map<string, RealtimeSession>();

const RESPONSE_FILLER_DELAY_MS = 3000;
const RESPONSE_TIMEOUT_MS = 15000;

/**
 * Create an OpenAI Realtime session for a call.
 */
export async function createRealtimeSession(
  prisma: PrismaClient,
  callSid: string,
  callId: string,
  hotelId: string,
  callerNumber?: string,
): Promise<RealtimeSession> {
  const env = getEnv();

  const url = `wss://api.openai.com/v1/realtime?model=${env.OPENAI_REALTIME_MODEL}`;

  const ws = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  const toolHandlers = createToolHandlers(prisma, callSid, callId, hotelId);

  const session: RealtimeSession = {
    ws, callSid, callId, toolHandlers,
    transcript: [],
    responseTimer: null,
    responseTimeoutTimer: null,
    sessionConfigured: false,
    hotelConfig: null,
    isResponseActive: false,
  };
  activeSessions.set(callSid, session);

  // Load hotel config from DB
  let hotelCfg: HotelConfig | null = null;
  try {
    hotelCfg = await getHotelConfig(prisma, hotelId);
  } catch (err) {
    logger.warn({ err, callSid, hotelId }, 'Failed to load hotel config');
  }

  // Load guest context for returning callers
  let guestContext = '';
  if (callerNumber) {
    try {
      guestContext = await getGuestContext(prisma, callerNumber);
    } catch (err) {
      logger.warn({ err, callSid }, 'Failed to load guest context');
    }
  }

  ws.on('open', () => {
    logger.info({ callSid, hotelId, hotelName: hotelCfg?.name }, 'OpenAI Realtime WebSocket connected');

    session.hotelConfig = hotelCfg;
    const instructions = getSystemPrompt(hotelCfg ?? undefined) + (guestContext ? `\n\n${guestContext}` : '');

    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions,
        voice: 'shimmer',
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
        },
        tools: toolDefinitions,
        tool_choice: 'auto',
        temperature: 0.6,
      },
    };

    ws.send(JSON.stringify(sessionConfig));
    logger.info({ callSid, hasGuestContext: !!guestContext }, 'Session configured');
  });

  ws.on('message', async (data) => {
    try {
      const event = JSON.parse(data.toString()) as Record<string, unknown>;
      await handleRealtimeEvent(prisma, session, event);
    } catch (err) {
      logger.error({ err, callSid }, 'Error handling Realtime event');
    }
  });

  ws.on('error', (err) => {
    logger.error({ err, callSid }, 'OpenAI Realtime WebSocket error');
  });

  ws.on('close', (code, reason) => {
    logger.info({ callSid, code, reason: reason.toString() }, 'OpenAI Realtime WebSocket closed');
    clearTimers(session);
    activeSessions.delete(callSid);
  });

  return session;
}

/**
 * Handle events from the OpenAI Realtime API.
 */
async function handleRealtimeEvent(
  prisma: PrismaClient,
  session: RealtimeSession,
  event: Record<string, unknown>,
): Promise<void> {
  const { callSid, ws, toolHandlers } = session;
  const eventType = event['type'] as string;

  switch (eventType) {
    case 'session.created': {
      const sessionData = event['session'] as { id?: string } | undefined;
      logger.info({ callSid, openaiSessionId: sessionData?.id }, 'Realtime session created');
      if (sessionData?.id) {
        await updateCallSession(callSid, { openaiSessionId: sessionData.id });
      }
      break;
    }

    case 'session.updated': {
      // Only trigger greeting once
      if (session.sessionConfigured) break;
      session.sessionConfigured = true;

      logger.debug({ callSid }, 'Session updated');

      const hotelName = session.hotelConfig?.name ?? getEnv().DEFAULT_HOTEL_NAME;
      const customGreeting = session.hotelConfig?.greeting;

      const greetingInstruction = customGreeting
        ? `[System: Caller connected. Say: "${customGreeting}" Then wait.]`
        : `[System: Caller connected. Say exactly: "Thank you for calling ${hotelName}! English, español, français, или русский?" Then stop and wait for their response. Say NOTHING else until they speak.]`;

      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: greetingInstruction,
          }],
        },
      }));
      ws.send(JSON.stringify({ type: 'response.create' }));
      logger.info({ callSid }, 'Initial greeting triggered');
      break;
    }

    case 'input_audio_buffer.speech_started': {
      logger.debug({ callSid, isResponseActive: session.isResponseActive }, 'User started speaking');
      // Only cancel if AI is actively responding (barge-in)
      if (session.isResponseActive) {
        ws.send(JSON.stringify({ type: 'response.cancel' }));
        session.isResponseActive = false;
      }
      clearTimers(session);
      break;
    }

    case 'input_audio_buffer.speech_stopped':
      logger.debug({ callSid }, 'User stopped speaking');
      break;

    case 'conversation.item.input_audio_transcription.completed': {
      const transcript = event['transcript'] as string | undefined;
      if (transcript?.trim()) {
        logger.info({ callSid, transcript }, 'User transcription');
        session.transcript.push({ role: 'user', text: transcript.trim(), timestamp: Date.now() });
        // Persist to DB
        saveTranscriptEvent(prisma, session.callId, 'user', transcript.trim());
        // Detect language from first user utterance
        detectAndUpdateLanguage(prisma, callSid, transcript.trim());
      }
      break;
    }

    case 'response.audio_transcript.done': {
      const transcript = event['transcript'] as string | undefined;
      if (transcript?.trim()) {
        logger.info({ callSid, transcript }, 'Assistant response transcript');
        session.transcript.push({ role: 'assistant', text: transcript.trim(), timestamp: Date.now() });
        saveTranscriptEvent(prisma, session.callId, 'assistant', transcript.trim());
      }
      break;
    }

    case 'response.audio.delta': {
      // Audio is being sent — clear filler timer since response arrived
      clearTimers(session);
      break;
    }

    case 'response.created': {
      session.isResponseActive = true;
      startResponseTimers(session, prisma);
      break;
    }

    case 'response.done': {
      session.isResponseActive = false;
      clearTimers(session);
      break;
    }

    case 'response.cancelled': {
      session.isResponseActive = false;
      logger.debug({ callSid }, 'Response cancelled (barge-in)');
      clearTimers(session);
      break;
    }

    case 'response.function_call_arguments.done': {
      const name = event['name'] as string;
      const callId = event['call_id'] as string;
      const argsStr = event['arguments'] as string;

      logger.info({ callSid, tool: name, callId }, 'Function call received');

      try {
        const args = JSON.parse(argsStr);
        const handler = toolHandlers[name];

        if (!handler) {
          logger.warn({ callSid, tool: name }, 'Unknown tool called');
          ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify({ error: true, message: `Unknown tool: ${name}` }),
            },
          }));
        } else {
          const result = await handler(args);

          ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify(result),
            },
          }));

          ws.send(JSON.stringify({ type: 'response.create' }));
        }
      } catch (err) {
        logger.error({ err, callSid, tool: name }, 'Error executing function call');
        ws.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({ error: true, message: 'Internal error executing tool' }),
          },
        }));
        ws.send(JSON.stringify({ type: 'response.create' }));
      }
      break;
    }

    case 'error': {
      const error = event['error'] as { message?: string; code?: string } | undefined;
      // Suppress known non-fatal errors
      if (error?.code === 'response_cancel_not_active') {
        logger.debug({ callSid }, 'Cancel sent with no active response (ignored)');
      } else {
        logger.error({ callSid, error }, 'OpenAI Realtime error event');
      }
      break;
    }

    default:
      logger.trace({ callSid, eventType }, 'Unhandled Realtime event');
  }
}

// --- Transcript persistence ---

function saveTranscriptEvent(
  prisma: PrismaClient,
  callId: string,
  role: 'user' | 'assistant',
  text: string,
): void {
  prisma.callEvent.create({
    data: {
      callId,
      event: `transcript.${role}`,
      data: { role, text, timestamp: new Date().toISOString() },
    },
  }).catch((err: unknown) => {
    logger.warn({ err, callId }, 'Failed to save transcript event');
  });
}

/**
 * Build full transcript from session and save to Call.transcriptSummary
 */
export async function saveCallTranscript(
  prisma: PrismaClient,
  callSid: string,
): Promise<void> {
  const session = activeSessions.get(callSid);
  if (!session || session.transcript.length === 0) return;

  const summary = session.transcript
    .map((t) => `${t.role === 'user' ? 'Guest' : 'Agent'}: ${t.text}`)
    .join('\n');

  try {
    await prisma.call.update({
      where: { twilioCallSid: callSid },
      data: { transcriptSummary: summary },
    });
    logger.info({ callSid, lines: session.transcript.length }, 'Transcript saved');
  } catch (err) {
    logger.warn({ err, callSid }, 'Failed to save transcript summary');
  }
}

/**
 * Get conversation summary for handoff context
 */
export function getConversationSummary(callSid: string, maxEntries = 10): string {
  const session = activeSessions.get(callSid);
  if (!session || session.transcript.length === 0) return 'No conversation recorded.';

  const recent = session.transcript.slice(-maxEntries);
  return recent
    .map((t) => `${t.role === 'user' ? 'Guest' : 'Agent'}: ${t.text}`)
    .join('\n');
}

// --- Language detection ---

async function detectAndUpdateLanguage(
  prisma: PrismaClient,
  callSid: string,
  text: string,
): Promise<void> {
  const session = getCallSession(callSid);
  // Only detect on first user utterance
  const transcriptSession = activeSessions.get(callSid);
  if (!transcriptSession) return;
  const userEntries = transcriptSession.transcript.filter(t => t.role === 'user');
  if (userEntries.length > 1) return;

  // Simple language detection heuristics
  let lang = 'en';
  if (/[а-яёА-ЯЁ]/.test(text)) lang = 'ru';
  else if (/[áéíóúñ¿¡]/i.test(text) || /\b(hola|buenos|gracias|sí|por favor)\b/i.test(text)) lang = 'es';
  else if (/[àâçéèêëïîôùûüÿœæ]/i.test(text) || /\b(bonjour|merci|oui|s'il)\b/i.test(text)) lang = 'fr';
  else if (/[äöüß]/i.test(text) || /\b(hallo|danke|bitte|guten)\b/i.test(text)) lang = 'de';
  else if (/[ãõ]/i.test(text) || /\b(olá|obrigad|bom dia)\b/i.test(text)) lang = 'pt';

  try {
    const callSession = await getCallSession(callSid);
    if (callSession?.guestId) {
      await prisma.guest.update({
        where: { id: callSession.guestId },
        data: { language: lang },
      });
    }
    await updateCallSession(callSid, { language: lang });
    logger.info({ callSid, language: lang }, 'Language detected and saved');
  } catch (err) {
    logger.warn({ err, callSid }, 'Failed to update language');
  }
}

// --- Latency handling ---

function startResponseTimers(session: RealtimeSession, prisma: PrismaClient): void {
  clearTimers(session);
  const { ws, callSid } = session;

  // Filler after 3s of silence
  session.responseTimer = setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) return;
    logger.info({ callSid }, 'Sending filler response (latency)');
    ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: '[System: The system is taking a moment to process. Say a brief filler like "One moment please..." or "Un momento..." in the language you are currently using. Keep it to 2-3 words.]',
        }],
      },
    }));
    ws.send(JSON.stringify({ type: 'response.create' }));
  }, RESPONSE_FILLER_DELAY_MS);

  // Hard timeout after 15s
  session.responseTimeoutTimer = setTimeout(() => {
    logger.error({ callSid }, 'Response timeout — triggering handoff');
    const handler = session.toolHandlers['transfer_to_human'];
    if (handler) {
      handler({ reason: 'tool_failure', description: 'AI response timeout' }).catch((err: unknown) => {
        logger.error({ err, callSid }, 'Failed to trigger timeout handoff');
      });
    }
  }, RESPONSE_TIMEOUT_MS);
}

function clearTimers(session: RealtimeSession): void {
  if (session.responseTimer) {
    clearTimeout(session.responseTimer);
    session.responseTimer = null;
  }
  if (session.responseTimeoutTimer) {
    clearTimeout(session.responseTimeoutTimer);
    session.responseTimeoutTimer = null;
  }
}

// --- Public API ---

export function sendAudioToRealtime(callSid: string, audioBase64: string): void {
  const session = activeSessions.get(callSid);
  if (!session || session.ws.readyState !== WebSocket.OPEN) return;

  session.ws.send(JSON.stringify({
    type: 'input_audio_buffer.append',
    audio: audioBase64,
  }));
}

export function getRealtimeSession(callSid: string): RealtimeSession | undefined {
  return activeSessions.get(callSid);
}

export function closeRealtimeSession(callSid: string): void {
  const session = activeSessions.get(callSid);
  if (session) {
    clearTimers(session);
    session.ws.close();
    activeSessions.delete(callSid);
    logger.info({ callSid }, 'Realtime session closed');
  }
}
