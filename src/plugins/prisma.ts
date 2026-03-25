import { PrismaClient } from '@prisma/client';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { getLogger } from '../lib/logger.js';

// Augment Fastify with prisma
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function prismaPlugin(fastify: FastifyInstance): Promise<void> {
  const logger = getLogger();
  const prisma = new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  prisma.$on('error', (e) => logger.error({ err: e }, 'Prisma error'));
  prisma.$on('warn', (e) => logger.warn({ msg: e }, 'Prisma warning'));

  await prisma.$connect();
  logger.info('Prisma connected to database');

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
    logger.info('Prisma disconnected');
  });
}

export default fp(prismaPlugin, { name: 'prisma' });
