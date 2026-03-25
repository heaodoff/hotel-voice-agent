import type { FastifyInstance } from 'fastify';
import { getDashboardMetrics, getFilteredCalls, getCallTimeline, searchGuests } from './analytics.service.js';

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/analytics/dashboard', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const period = (['day', 'week', 'month'].includes(query['period'] ?? '') ? query['period'] : 'week') as 'day' | 'week' | 'month';

    const metrics = await getDashboardMetrics(fastify.prisma, {
      hotelId: query['hotelId'],
      period,
    });

    return reply.send(metrics);
  });

  fastify.get('/api/analytics/calls', async (request, reply) => {
    const query = request.query as Record<string, string>;

    const result = await getFilteredCalls(fastify.prisma, {
      hotelId: query['hotelId'],
      status: query['status'],
      language: query['language'],
      from: query['from'],
      to: query['to'],
      page: query['page'] ? parseInt(query['page'], 10) : undefined,
      limit: query['limit'] ? parseInt(query['limit'], 10) : undefined,
    });

    return reply.send(result);
  });

  fastify.get('/api/calls/:callSid/timeline', async (request, reply) => {
    const { callSid } = request.params as { callSid: string };
    const result = await getCallTimeline(fastify.prisma, callSid);
    if (!result) return reply.status(404).send({ error: 'Call not found' });
    return reply.send(result);
  });

  fastify.get('/api/guests/search', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const q = query['q'] ?? '';
    if (q.length < 2) return reply.send([]);
    const guests = await searchGuests(fastify.prisma, q);
    return reply.send(guests);
  });
}
