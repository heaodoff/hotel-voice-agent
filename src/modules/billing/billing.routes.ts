import type { FastifyInstance } from 'fastify';
import {
  getCurrentUsage,
  recalculateUsage,
  getUsageHistory,
  getAllHotelsBilling,
  updateBillingPlan,
  BILLING_PLANS,
} from './billing.service.js';

export async function billingRoutes(fastify: FastifyInstance): Promise<void> {
  // Get all billing plans
  fastify.get('/api/billing/plans', async (_request, reply) => {
    return reply.send(BILLING_PLANS);
  });

  // Get billing overview for all hotels
  fastify.get('/api/billing/overview', async (_request, reply) => {
    const overview = await getAllHotelsBilling(fastify.prisma);
    return reply.send(overview);
  });

  // Get current usage for a hotel
  fastify.get('/api/billing/hotels/:hotelId/usage', async (request, reply) => {
    const { hotelId } = request.params as { hotelId: string };
    const usage = await getCurrentUsage(fastify.prisma, hotelId);
    return reply.send(usage);
  });

  // Recalculate usage for a hotel (trigger manually or via cron)
  fastify.post('/api/billing/hotels/:hotelId/recalculate', async (request, reply) => {
    const { hotelId } = request.params as { hotelId: string };
    const usage = await recalculateUsage(fastify.prisma, hotelId);
    if (!usage) return reply.status(404).send({ error: 'Hotel not found' });
    return reply.send(usage);
  });

  // Get usage history for a hotel
  fastify.get('/api/billing/hotels/:hotelId/history', async (request, reply) => {
    const { hotelId } = request.params as { hotelId: string };
    const query = request.query as Record<string, string>;
    const months = query['months'] ? parseInt(query['months'], 10) : 6;
    const history = await getUsageHistory(fastify.prisma, hotelId, months);
    return reply.send(history);
  });

  // Update billing plan for a hotel
  fastify.put('/api/billing/hotels/:hotelId/plan', async (request, reply) => {
    const { hotelId } = request.params as { hotelId: string };
    const body = request.body as { plan: string };
    if (!body.plan) return reply.status(400).send({ error: 'plan is required' });

    try {
      const hotel = await updateBillingPlan(fastify.prisma, hotelId, body.plan);
      return reply.send(hotel);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });
}
