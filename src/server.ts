import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { loadEnv } from './config/index.js';
import { getLogger } from './lib/logger.js';
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import { twilioRoutes } from './modules/twilio/index.js';
import { telnyxRoutes } from './modules/telnyx/index.js';
import { callRoutes } from './modules/calls/index.js';
import { reservationRoutes } from './modules/reservations/index.js';
import { hotelRoutes } from './modules/hotels/index.js';
import { analyticsRoutes } from './modules/analytics/index.js';
import { billingRoutes } from './modules/billing/index.js';
import { registerSecurityHooks } from './lib/middleware.js';

// Load and validate env first
const env = loadEnv();
const logger = getLogger();

const fastify = Fastify({
  logger: false, // We use our own Pino instance
  trustProxy: true,
});

async function start(): Promise<void> {
  // Plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);
  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);

  // Parse incoming Twilio webhooks (application/x-www-form-urlencoded)
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const params = new URLSearchParams(body as string);
        const result: Record<string, string> = {};
        for (const [key, value] of params.entries()) {
          result[key] = value;
        }
        done(null, result);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // Security: rate limiting, Twilio signature validation, API key auth
  registerSecurityHooks(fastify);

  // Health check (no auth required)
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Routes
  await fastify.register(twilioRoutes);
  await fastify.register(telnyxRoutes);
  await fastify.register(callRoutes);
  await fastify.register(reservationRoutes);
  await fastify.register(hotelRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(billingRoutes);

  // Error handler
  fastify.setErrorHandler((err, request, reply) => {
    const error = err as Error & { statusCode?: number };
    logger.error({ err: error, url: request.url, method: request.method }, 'Unhandled error');
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: error.name,
      message: error.message,
      statusCode,
    });
  });

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, 'Received shutdown signal');
      await fastify.close();
      process.exit(0);
    });
  }

  await fastify.listen({ port: env.PORT, host: env.HOST });
  logger.info({ port: env.PORT, host: env.HOST, env: env.NODE_ENV }, 'Server started');

  // Seed default hotel if not exists (for dev convenience)
  try {
    await fastify.prisma.hotel.upsert({
      where: { id: env.DEFAULT_HOTEL_ID },
      update: { phoneNumber: env.DEFAULT_HOTEL_PHONE }, // keep phone in sync for routing
      create: {
        id: env.DEFAULT_HOTEL_ID,
        name: env.DEFAULT_HOTEL_NAME,
        timezone: env.DEFAULT_HOTEL_TIMEZONE,
        phoneNumber: env.DEFAULT_HOTEL_PHONE,
        policies: {
          parking: 'Complimentary self-parking, valet $35/night',
          breakfast: 'Complimentary continental breakfast 6:30-10:00 AM',
          pets: 'Dogs allowed (under 25 lbs), $50/night pet fee',
          wifi: 'Complimentary throughout the property',
          pool: 'Outdoor pool open 7:00 AM - 10:00 PM (seasonal)',
          cancellation: 'Free cancellation up to 24 hours before check-in',
        },
      },
    });
    logger.info({ hotelId: env.DEFAULT_HOTEL_ID }, 'Default hotel seeded');
  } catch (err) {
    logger.error({ err }, 'Failed to seed default hotel');
  }
}

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
