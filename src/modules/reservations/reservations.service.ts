import type { PrismaClient } from '@prisma/client';
import { getPmsProvider, getPmsProviderForHotel } from '../pms/index.js';
import { createChildLogger } from '../../lib/logger.js';
import type {
  CheckAvailabilityInput,
  GetRatesInput,
  CreateReservationInput,
  ModifyReservationInput,
  CancelReservationInput,
  FindReservationInput,
  AvailabilityResult,
  RateInfo,
  ReservationResult,
} from '../../lib/types.js';

const logger = createChildLogger({ module: 'reservations' });

/**
 * Orchestration layer between AI tools and PMS.
 * Records reservations in our DB and delegates to PMS provider.
 */

export async function checkAvailability(input: CheckAvailabilityInput, prisma?: PrismaClient): Promise<AvailabilityResult> {
  const pms = prisma ? await getPmsProviderForHotel(prisma, input.hotelId) : getPmsProvider();
  return pms.checkAvailability(input);
}

export async function getRoomRates(input: GetRatesInput, prisma?: PrismaClient): Promise<RateInfo[]> {
  const pms = prisma ? await getPmsProviderForHotel(prisma, input.hotelId) : getPmsProvider();
  return pms.getRates(input);
}

export async function createReservation(
  prisma: PrismaClient,
  input: CreateReservationInput,
): Promise<ReservationResult> {
  const pms = await getPmsProviderForHotel(prisma, input.hotelId);
  const result = await pms.createReservation(input);

  // Persist to our DB
  const guest = await prisma.guest.upsert({
    where: { phoneNumber: input.guestPhone },
    update: {
      firstName: input.guestFirstName,
      lastName: input.guestLastName,
      ...(input.guestEmail ? { email: input.guestEmail } : {}),
    },
    create: {
      phoneNumber: input.guestPhone,
      firstName: input.guestFirstName,
      lastName: input.guestLastName,
      email: input.guestEmail,
    },
  });

  const reservation = await prisma.reservation.create({
    data: {
      externalReservationId: result.reservationId,
      hotelId: input.hotelId,
      guestId: guest.id,
      status: 'CONFIRMED',
      checkInDate: new Date(input.checkInDate),
      checkOutDate: new Date(input.checkOutDate),
      roomType: input.roomType,
      roomCount: input.roomCount,
      guestCount: input.guestCount,
      totalPrice: result.totalPrice,
      currency: result.currency,
      specialRequests: input.specialRequests,
      confirmationCode: result.confirmationCode,
    },
  });

  await prisma.reservationEvent.create({
    data: {
      reservationId: reservation.id,
      event: 'created',
      newState: result as unknown as object,
      triggeredBy: 'ai_agent',
    },
  });

  logger.info({ reservationId: reservation.id, confirmationCode: result.confirmationCode }, 'Reservation created in DB');
  return result;
}

export async function modifyReservation(
  prisma: PrismaClient,
  input: ModifyReservationInput,
): Promise<ReservationResult> {
  // Resolve hotelId from existing reservation if needed
  let hotelId: string | undefined;
  if (input.confirmationCode) {
    const existing = await prisma.reservation.findUnique({ where: { confirmationCode: input.confirmationCode }, select: { hotelId: true } });
    hotelId = existing?.hotelId;
  }
  const pms = hotelId ? await getPmsProviderForHotel(prisma, hotelId) : getPmsProvider();
  const result = await pms.modifyReservation(input);

  // Update our DB
  if (input.confirmationCode) {
    const existing = await prisma.reservation.findUnique({
      where: { confirmationCode: input.confirmationCode },
    });
    if (existing) {
      const previousState = {
        checkInDate: existing.checkInDate,
        checkOutDate: existing.checkOutDate,
        roomType: existing.roomType,
        guestCount: existing.guestCount,
      };

      await prisma.reservation.update({
        where: { id: existing.id },
        data: {
          status: 'MODIFIED',
          ...(input.checkInDate ? { checkInDate: new Date(input.checkInDate) } : {}),
          ...(input.checkOutDate ? { checkOutDate: new Date(input.checkOutDate) } : {}),
          ...(input.roomType ? { roomType: input.roomType } : {}),
          ...(input.guestCount ? { guestCount: input.guestCount } : {}),
          ...(input.specialRequests !== undefined ? { specialRequests: input.specialRequests } : {}),
          totalPrice: result.totalPrice,
        },
      });

      await prisma.reservationEvent.create({
        data: {
          reservationId: existing.id,
          event: 'modified',
          previousState: previousState as object,
          newState: result as unknown as object,
          triggeredBy: 'ai_agent',
        },
      });
    }
  }

  return result;
}

export async function cancelReservation(
  prisma: PrismaClient,
  input: CancelReservationInput,
): Promise<{ success: boolean; message: string }> {
  let hotelId: string | undefined;
  if (input.confirmationCode) {
    const existing = await prisma.reservation.findUnique({ where: { confirmationCode: input.confirmationCode }, select: { hotelId: true } });
    hotelId = existing?.hotelId;
  }
  const pms = hotelId ? await getPmsProviderForHotel(prisma, hotelId) : getPmsProvider();
  const result = await pms.cancelReservation(input);

  if (result.success && input.confirmationCode) {
    const existing = await prisma.reservation.findUnique({
      where: { confirmationCode: input.confirmationCode },
    });
    if (existing) {
      await prisma.reservation.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED' },
      });

      await prisma.reservationEvent.create({
        data: {
          reservationId: existing.id,
          event: 'cancelled',
          previousState: { status: existing.status },
          newState: { status: 'CANCELLED' },
          triggeredBy: 'ai_agent',
        },
      });
    }
  }

  return result;
}

export async function findReservation(input: FindReservationInput, prisma?: PrismaClient, hotelId?: string): Promise<ReservationResult | null> {
  const pms = prisma && hotelId ? await getPmsProviderForHotel(prisma, hotelId) : getPmsProvider();
  return pms.findReservation(input);
}
