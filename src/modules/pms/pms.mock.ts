import { randomUUID } from 'node:crypto';
import type { PmsProvider } from './pms.interface.js';
import type {
  CheckAvailabilityInput,
  AvailabilityResult,
  GetRatesInput,
  RateInfo,
  CreateReservationInput,
  ReservationResult,
  ModifyReservationInput,
  CancelReservationInput,
  FindReservationInput,
  RoomType,
} from '../../lib/types.js';
import { NotFoundError, PmsError } from '../../lib/errors.js';
import { createChildLogger } from '../../lib/logger.js';

const logger = createChildLogger({ module: 'pms-mock' });

// Mock data store
interface MockReservation extends ReservationResult {
  guestPhone: string;
  guestEmail?: string;
  cancelled: boolean;
}

const BASE_RATES: Record<RoomType, number> = {
  standard: 129,
  deluxe: 199,
  suite: 349,
  family: 249,
  penthouse: 599,
};

// Simulated room inventory per type
const TOTAL_ROOMS: Record<RoomType, number> = {
  standard: 40,
  deluxe: 20,
  suite: 8,
  family: 12,
  penthouse: 2,
};

const MAX_CAPACITY: Record<RoomType, number> = {
  standard: 2,
  deluxe: 2,
  suite: 3,
  family: 5,
  penthouse: 4,
};

function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GP-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function countNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

// Weekend surcharge multiplier
function getRateMultiplier(date: string): number {
  const d = new Date(date);
  const day = d.getDay();
  return day === 5 || day === 6 ? 1.2 : 1.0; // Fri/Sat premium
}

export class MockPmsProvider implements PmsProvider {
  readonly name = 'mock';
  private reservations: Map<string, MockReservation> = new Map();

  // Seed some existing reservations for testing
  constructor() {
    const seed: MockReservation = {
      reservationId: 'res_seed_001',
      confirmationCode: 'GP-TEST01',
      status: 'CONFIRMED',
      hotelName: 'Grand Plaza Hotel',
      guestName: 'John Smith',
      guestPhone: '+15551234567',
      guestEmail: 'john@example.com',
      checkInDate: '2026-04-01',
      checkOutDate: '2026-04-03',
      roomType: 'deluxe',
      roomCount: 1,
      guestCount: 2,
      totalPrice: 398,
      currency: 'USD',
      cancelled: false,
    };
    this.reservations.set(seed.reservationId, seed);
    this.reservations.set(seed.confirmationCode, seed);
  }

  async checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityResult> {
    logger.info({ input }, 'Checking availability');

    const nights = countNights(input.checkInDate, input.checkOutDate);
    const guestCount = input.guestCount ?? 1;
    const allTypes = input.roomType ? [input.roomType] : (['standard', 'deluxe', 'suite', 'family', 'penthouse'] as RoomType[]);
    // Filter by capacity — only return rooms that can fit the guest count
    const roomTypes = allTypes.filter((type) => (MAX_CAPACITY[type] ?? 2) >= guestCount);

    // Simulate some rooms being booked
    const rooms = roomTypes.map((type) => {
      const total = TOTAL_ROOMS[type] ?? 10;
      const booked = Math.floor(Math.random() * (total * 0.7));
      const left = total - booked;
      const rate = BASE_RATES[type] ?? 129;
      const multiplier = getRateMultiplier(input.checkInDate);

      return {
        roomType: type,
        available: left > 0,
        roomsLeft: left,
        maxCapacity: MAX_CAPACITY[type] ?? 2,
        ratePerNight: Math.round(rate * multiplier),
        currency: 'USD',
      };
    });

    return {
      hotelId: input.hotelId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      nights,
      rooms,
    };
  }

  async getRates(input: GetRatesInput): Promise<RateInfo[]> {
    logger.info({ input }, 'Getting rates');

    const nights = countNights(input.checkInDate, input.checkOutDate);
    const roomTypes = input.roomType ? [input.roomType] : (['standard', 'deluxe', 'suite', 'family', 'penthouse'] as RoomType[]);
    const multiplier = getRateMultiplier(input.checkInDate);

    return roomTypes.map((type) => {
      const rate = Math.round((BASE_RATES[type] ?? 129) * multiplier);
      return {
        roomType: type,
        ratePerNight: rate,
        totalPrice: rate * nights,
        currency: 'USD',
        nights,
      };
    });
  }

  async createReservation(input: CreateReservationInput): Promise<ReservationResult> {
    logger.info({ input }, 'Creating reservation');

    // Validate dates
    const checkIn = new Date(input.checkInDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkIn < today) {
      throw new PmsError('Check-in date cannot be in the past');
    }

    // Validate room capacity
    const maxCap = MAX_CAPACITY[input.roomType] ?? 2;
    const guests = input.guestCount ?? 1;
    if (guests > maxCap) {
      throw new PmsError(`Room type "${input.roomType}" has maximum capacity of ${maxCap} guests, but ${guests} requested. Please choose a larger room type.`);
    }

    const nights = countNights(input.checkInDate, input.checkOutDate);
    const rate = BASE_RATES[input.roomType] ?? 129;
    const multiplier = getRateMultiplier(input.checkInDate);
    const totalPrice = Math.round(rate * multiplier * nights * input.roomCount);

    const reservation: MockReservation = {
      reservationId: `res_${randomUUID().slice(0, 8)}`,
      confirmationCode: generateConfirmationCode(),
      status: 'CONFIRMED',
      hotelName: 'Grand Plaza Hotel',
      guestName: `${input.guestFirstName} ${input.guestLastName}`,
      guestPhone: input.guestPhone,
      guestEmail: input.guestEmail,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      roomType: input.roomType,
      roomCount: input.roomCount,
      guestCount: input.guestCount,
      totalPrice,
      currency: 'USD',
      specialRequests: input.specialRequests,
      cancelled: false,
    };

    this.reservations.set(reservation.reservationId, reservation);
    this.reservations.set(reservation.confirmationCode, reservation);

    logger.info({ reservationId: reservation.reservationId, confirmationCode: reservation.confirmationCode }, 'Reservation created');
    return reservation;
  }

  async modifyReservation(input: ModifyReservationInput): Promise<ReservationResult> {
    logger.info({ input }, 'Modifying reservation');

    const existing = await this.lookupReservation(input.reservationId, input.confirmationCode, input.guestPhone);
    if (!existing) {
      throw new NotFoundError('Reservation');
    }
    if (existing.cancelled) {
      throw new PmsError('Cannot modify a cancelled reservation');
    }

    if (input.checkInDate) existing.checkInDate = input.checkInDate;
    if (input.checkOutDate) existing.checkOutDate = input.checkOutDate;
    if (input.roomType) existing.roomType = input.roomType;
    if (input.guestCount) existing.guestCount = input.guestCount;
    if (input.specialRequests !== undefined) existing.specialRequests = input.specialRequests;

    // Recalculate price
    const nights = countNights(existing.checkInDate, existing.checkOutDate);
    const rate = BASE_RATES[existing.roomType as RoomType] ?? 129;
    existing.totalPrice = Math.round(rate * nights * existing.roomCount);
    existing.status = 'CONFIRMED';

    this.reservations.set(existing.reservationId, existing);
    this.reservations.set(existing.confirmationCode, existing);

    logger.info({ reservationId: existing.reservationId }, 'Reservation modified');
    return existing;
  }

  async cancelReservation(input: CancelReservationInput): Promise<{ success: boolean; message: string }> {
    logger.info({ input }, 'Cancelling reservation');

    const existing = await this.lookupReservation(input.reservationId, input.confirmationCode, input.guestPhone);
    if (!existing) {
      throw new NotFoundError('Reservation');
    }
    if (existing.cancelled) {
      return { success: true, message: 'Reservation was already cancelled' };
    }

    existing.cancelled = true;
    existing.status = 'CANCELLED';
    this.reservations.set(existing.reservationId, existing);
    this.reservations.set(existing.confirmationCode, existing);

    logger.info({ reservationId: existing.reservationId }, 'Reservation cancelled');
    return { success: true, message: `Reservation ${existing.confirmationCode} has been cancelled` };
  }

  async findReservation(input: FindReservationInput): Promise<ReservationResult | null> {
    logger.info({ input }, 'Finding reservation');
    return this.lookupReservation(input.reservationId, input.confirmationCode, input.guestPhone);
  }

  private async lookupReservation(
    reservationId?: string,
    confirmationCode?: string,
    guestPhone?: string,
  ): Promise<MockReservation | null> {
    if (reservationId) {
      return this.reservations.get(reservationId) ?? null;
    }
    if (confirmationCode) {
      return this.reservations.get(confirmationCode) ?? null;
    }
    if (guestPhone) {
      for (const res of this.reservations.values()) {
        if (res.guestPhone === guestPhone && !res.cancelled) {
          return res;
        }
      }
    }
    return null;
  }
}
