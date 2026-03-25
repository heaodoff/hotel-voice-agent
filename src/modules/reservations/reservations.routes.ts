import type { FastifyInstance } from 'fastify';

export async function reservationRoutes(fastify: FastifyInstance): Promise<void> {
  // Test/debug endpoint: list reservations
  fastify.get('/api/reservations', async (_request, reply) => {
    const reservations = await fastify.prisma.reservation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { guest: true, events: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    return reply.send(reservations);
  });

  // Test/debug endpoint: get reservation by confirmation code
  fastify.get<{ Params: { code: string } }>(
    '/api/reservations/:code',
    async (request, reply) => {
      const reservation = await fastify.prisma.reservation.findUnique({
        where: { confirmationCode: request.params.code },
        include: { guest: true, events: { orderBy: { createdAt: 'asc' } } },
      });

      if (!reservation) {
        return reply.status(404).send({ error: 'Reservation not found' });
      }

      return reply.send({ reservation });
    },
  );

}
