import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { getRedis, connectRedis, disconnectRedis } from '../lib/redis.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

async function redisPlugin(fastify: FastifyInstance): Promise<void> {
  await connectRedis();
  fastify.decorate('redis', getRedis());

  fastify.addHook('onClose', async () => {
    await disconnectRedis();
  });
}

export default fp(redisPlugin, { name: 'redis' });
