import type { FastifyInstance } from 'fastify';
import { getRecentCalls } from './calls.service.js';

export async function callRoutes(fastify: FastifyInstance): Promise<void> {
  // Debug endpoint: list recent calls with tool logs
  fastify.get('/api/calls', async (request, reply) => {
    const limit = (request.query as { limit?: string }).limit;
    const calls = await getRecentCalls(fastify.prisma, limit ? parseInt(limit, 10) : 20);
    return reply.send({ calls });
  });

  // Debug endpoint: get a specific call by SID
  fastify.get<{ Params: { callSid: string } }>('/api/calls/:callSid', async (request, reply) => {
    const call = await fastify.prisma.call.findUnique({
      where: { twilioCallSid: request.params.callSid },
      include: {
        guest: true,
        events: { orderBy: { createdAt: 'asc' } },
        toolLogs: { orderBy: { createdAt: 'asc' } },
        handoffs: true,
        sessions: true,
      },
    });

    if (!call) {
      return reply.status(404).send({ error: 'Call not found' });
    }

    return reply.send({ call });
  });
}
