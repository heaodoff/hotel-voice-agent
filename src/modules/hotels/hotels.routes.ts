import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { createHotel, updateHotel, listHotels, getHotelById } from './hotels.service.js';
import { createChildLogger } from '../../lib/logger.js';

const logger = createChildLogger({ module: 'hotel-routes' });

export async function hotelRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/hotels', async (_request, reply) => {
    const hotels = await listHotels(fastify.prisma);
    return reply.send(hotels);
  });

  fastify.get('/api/hotels/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const hotel = await getHotelById(fastify.prisma, id);
    if (!hotel) return reply.status(404).send({ error: 'Hotel not found' });
    return reply.send(hotel);
  });

  fastify.post('/api/hotels', async (request, reply) => {
    const body = request.body as {
      name: string;
      phoneNumber: string;
      timezone?: string;
      handoffPhone?: string;
      greeting?: string;
      checkInTime?: string;
      checkOutTime?: string;
      policies?: Prisma.InputJsonValue;
      pmsProvider?: string;
      pmsConfig?: Prisma.InputJsonValue;
    };

    if (!body.name || !body.phoneNumber) {
      return reply.status(400).send({ error: 'name and phoneNumber are required' });
    }

    try {
      const hotel = await createHotel(fastify.prisma, body);
      return reply.status(201).send(hotel);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('Unique constraint')) {
        return reply.status(409).send({ error: 'Phone number already in use' });
      }
      logger.error({ err }, 'Failed to create hotel');
      return reply.status(500).send({ error: 'Failed to create hotel' });
    }
  });

  fastify.put('/api/hotels/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    try {
      const hotel = await updateHotel(fastify.prisma, id, body);
      return reply.send(hotel);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('Record to update not found')) {
        return reply.status(404).send({ error: 'Hotel not found' });
      }
      logger.error({ err, hotelId: id }, 'Failed to update hotel');
      return reply.status(500).send({ error: 'Failed to update hotel' });
    }
  });

  fastify.delete('/api/hotels/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await updateHotel(fastify.prisma, id, { active: false });
      return reply.send({ ok: true, message: 'Hotel deactivated' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('Record to update not found')) {
        return reply.status(404).send({ error: 'Hotel not found' });
      }
      return reply.status(500).send({ error: 'Failed to deactivate hotel' });
    }
  });
}
