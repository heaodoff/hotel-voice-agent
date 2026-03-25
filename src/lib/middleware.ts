import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Twilio from 'twilio';
import { getEnv } from '../config/index.js';
import { createChildLogger } from './logger.js';
import { getRedis } from './redis.js';

const logger = createChildLogger({ module: 'middleware' });

/**
 * Twilio signature validation.
 * Verifies that incoming webhook requests actually come from Twilio.
 */
export function twilioSignatureHook(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const env = getEnv();

  if (env.VALIDATE_TWILIO_SIGNATURE !== 'true') {
    done();
    return;
  }

  const signature = request.headers['x-twilio-signature'] as string | undefined;
  if (!signature) {
    logger.warn({ url: request.url }, 'Missing Twilio signature');
    reply.status(403).send({ error: 'Missing Twilio signature' });
    return;
  }

  const url = `${env.TWILIO_WEBHOOK_BASE_URL}${request.url}`;
  const params = (request.body ?? {}) as Record<string, string>;

  const isValid = Twilio.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    params,
  );

  if (!isValid) {
    logger.warn({ url: request.url }, 'Invalid Twilio signature');
    reply.status(403).send({ error: 'Invalid Twilio signature' });
    return;
  }

  done();
}

/**
 * API key authentication for admin endpoints.
 * Checks Authorization: Bearer <ADMIN_API_KEY> header.
 */
export function apiKeyAuthHook(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const env = getEnv();

  // Skip auth if no ADMIN_API_KEY configured (dev mode)
  if (!env.ADMIN_API_KEY) {
    done();
    return;
  }

  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Missing Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== env.ADMIN_API_KEY) {
    logger.warn({ url: request.url }, 'Invalid API key');
    reply.status(401).send({ error: 'Invalid API key' });
    return;
  }

  done();
}

/**
 * Redis-based rate limiter.
 * Uses sliding window counter per IP.
 */
export async function rateLimiter(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  try {
    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `ratelimit:${key}:${now - (now % windowSeconds)}`;

    const count = await redis.incr(windowKey);
    if (count === 1) {
      await redis.expire(windowKey, windowSeconds + 1);
    }

    if (count > maxRequests) {
      return { allowed: false, remaining: 0, retryAfter: windowSeconds };
    }

    return { allowed: true, remaining: maxRequests - count };
  } catch {
    // If Redis is down, allow the request
    return { allowed: true, remaining: maxRequests };
  }
}

/**
 * Register rate limiting and security hooks on Fastify.
 */
export function registerSecurityHooks(fastify: FastifyInstance): void {
  const env = getEnv();
  const webhookRpm = env.RATE_LIMIT_WEBHOOK_RPM;
  const apiRpm = env.RATE_LIMIT_API_RPM;

  // Twilio webhook signature validation
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/twilio/')) {
      // Rate limit webhooks
      const ip = request.ip;
      const { allowed, retryAfter } = await rateLimiter(`webhook:${ip}`, webhookRpm, 60);
      if (!allowed) {
        logger.warn({ ip, url: request.url }, 'Webhook rate limit exceeded');
        reply.status(429).send({ error: 'Too many requests', retryAfter });
        return;
      }
    }

    if (request.url.startsWith('/api/')) {
      // Rate limit API
      const ip = request.ip;
      const { allowed, remaining, retryAfter } = await rateLimiter(`api:${ip}`, apiRpm, 60);
      reply.header('X-RateLimit-Limit', apiRpm);
      reply.header('X-RateLimit-Remaining', remaining);
      if (!allowed) {
        logger.warn({ ip, url: request.url }, 'API rate limit exceeded');
        reply.header('Retry-After', retryAfter);
        reply.status(429).send({ error: 'Too many requests', retryAfter });
        return;
      }

      // API key auth for write operations (POST/PUT/DELETE)
      if (['POST', 'PUT', 'DELETE'].includes(request.method) && !request.url.startsWith('/api/analytics')) {
        const authHeader = request.headers['authorization'];
        if (env.ADMIN_API_KEY) {
          if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== env.ADMIN_API_KEY) {
            reply.status(401).send({ error: 'Unauthorized' });
            return;
          }
        }
      }
    }
  });

  // Twilio signature validation on Twilio routes
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/twilio/') && request.method === 'POST') {
      if (env.VALIDATE_TWILIO_SIGNATURE !== 'true') return;

      const signature = request.headers['x-twilio-signature'] as string | undefined;
      if (!signature) {
        reply.status(403).send({ error: 'Missing Twilio signature' });
        return;
      }

      const url = `${env.TWILIO_WEBHOOK_BASE_URL}${request.url}`;
      const params = (request.body ?? {}) as Record<string, string>;
      const isValid = Twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, params);

      if (!isValid) {
        logger.warn({ url: request.url }, 'Invalid Twilio signature rejected');
        reply.status(403).send({ error: 'Invalid Twilio signature' });
        return;
      }
    }
  });

  logger.info({
    twilioValidation: env.VALIDATE_TWILIO_SIGNATURE === 'true',
    webhookRpm,
    apiRpm,
    adminAuth: !!env.ADMIN_API_KEY,
  }, 'Security hooks registered');
}
