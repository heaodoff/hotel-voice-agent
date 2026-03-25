import { Redis } from 'ioredis';
import { getEnv } from '../config/index.js';
import { getLogger } from './logger.js';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;

  const env = getEnv();
  const logger = getLogger();

  _redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  _redis.on('connect', () => logger.info('Redis connected'));
  _redis.on('error', (err: Error) => logger.error({ err }, 'Redis error'));

  return _redis;
}

export async function connectRedis(): Promise<Redis> {
  const redis = getRedis();
  await redis.connect();
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}

// Session state helpers for call sessions
const CALL_SESSION_PREFIX = 'call_session:';
const CALL_SESSION_TTL = 3600; // 1 hour

export interface CallSessionState {
  callSid: string;
  hotelId: string;
  callerNumber: string;
  language?: string;
  guestId?: string;
  currentIntent?: string;
  reservationId?: string;
  conversationContext?: Record<string, unknown>;
  openaiSessionId?: string;
  startedAt: string;
}

export async function setCallSession(callSid: string, state: CallSessionState): Promise<void> {
  const redis = getRedis();
  await redis.set(
    `${CALL_SESSION_PREFIX}${callSid}`,
    JSON.stringify(state),
    'EX',
    CALL_SESSION_TTL,
  );
}

export async function getCallSession(callSid: string): Promise<CallSessionState | null> {
  const redis = getRedis();
  const data = await redis.get(`${CALL_SESSION_PREFIX}${callSid}`);
  if (!data) return null;
  return JSON.parse(data) as CallSessionState;
}

export async function updateCallSession(
  callSid: string,
  updates: Partial<CallSessionState>,
): Promise<CallSessionState | null> {
  const current = await getCallSession(callSid);
  if (!current) return null;
  const updated = { ...current, ...updates };
  await setCallSession(callSid, updated);
  return updated;
}

export async function deleteCallSession(callSid: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${CALL_SESSION_PREFIX}${callSid}`);
}
