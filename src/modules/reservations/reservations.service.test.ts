import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrisma, type MockPrisma } from '../../../tests/helpers/prisma.mock.js';

vi.mock('../../lib/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
}));

const mockPmsProvider = {
  name: 'mock',
  checkAvailability: vi.fn(),
  getRates: vi.fn(),
  createReservation: vi.fn(),
  modifyReservation: vi.fn(),
  cancelReservation: vi.fn(),
  findReservation: vi.fn(),
};

vi.mock('../pms/index.js', () => ({
  getPmsProvider: () => mockPmsProvider,
  getPmsProviderForHotel: () => Promise.resolve(mockPmsProvider),
}));

import {
  checkAvailability,
  getRoomRates,
  createReservation,
  modifyReservation,
  cancelReservation,
  findReservation,
} from './reservations.service.js';

describe('checkAvailability', () => {
  it('delegates to PMS provider', async () => {
    const expected = { hotelId: 'h1', nights: 2, rooms: [] };
    mockPmsProvider.checkAvailability.mockResolvedValue(expected);

    const result = await checkAvailability({ hotelId: 'h1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03', guestCount: 1 });
    expect(result).toEqual(expected);
    expect(mockPmsProvider.checkAvailability).toHaveBeenCalled();
  });
});

describe('getRoomRates', () => {
  it('delegates to PMS provider', async () => {
    const expected = [{ roomType: 'standard', ratePerNight: 129, totalPrice: 258, currency: 'USD', nights: 2 }];
    mockPmsProvider.getRates.mockResolvedValue(expected);

    const result = await getRoomRates({ hotelId: 'h1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03' });
    expect(result).toEqual(expected);
  });
});

describe('createReservation', () => {
  let prisma: MockPrisma;

  const pmsResult = {
    reservationId: 'res_1',
    confirmationCode: 'GP-ABC123',
    status: 'CONFIRMED',
    hotelName: 'Test Hotel',
    guestName: 'Jane Doe',
    checkInDate: '2026-04-01',
    checkOutDate: '2026-04-03',
    roomType: 'standard',
    roomCount: 1,
    guestCount: 2,
    totalPrice: 258,
    currency: 'USD',
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    mockPmsProvider.createReservation.mockResolvedValue(pmsResult);
    prisma.guest.upsert.mockResolvedValue({ id: 'guest_1' });
    prisma.reservation.create.mockResolvedValue({ id: 'res_db_1' });
    prisma.reservationEvent.create.mockResolvedValue({ id: 're_1' });
  });

  it('calls PMS createReservation', async () => {
    await createReservation(prisma, {
      hotelId: 'h1', guestFirstName: 'Jane', guestLastName: 'Doe',
      guestPhone: '+15551234567', checkInDate: '2026-04-01', checkOutDate: '2026-04-03',
      roomType: 'standard', roomCount: 1, guestCount: 2,
    });
    expect(mockPmsProvider.createReservation).toHaveBeenCalled();
  });

  it('upserts guest in DB', async () => {
    await createReservation(prisma, {
      hotelId: 'h1', guestFirstName: 'Jane', guestLastName: 'Doe',
      guestPhone: '+15551234567', checkInDate: '2026-04-01', checkOutDate: '2026-04-03',
      roomType: 'standard', roomCount: 1, guestCount: 2,
    });
    expect(prisma.guest.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { phoneNumber: '+15551234567' },
      create: expect.objectContaining({ firstName: 'Jane', lastName: 'Doe' }),
    }));
  });

  it('creates reservation in DB with confirmation code', async () => {
    await createReservation(prisma, {
      hotelId: 'h1', guestFirstName: 'Jane', guestLastName: 'Doe',
      guestPhone: '+15551234567', checkInDate: '2026-04-01', checkOutDate: '2026-04-03',
      roomType: 'standard', roomCount: 1, guestCount: 2,
    });
    expect(prisma.reservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confirmationCode: 'GP-ABC123',
        status: 'CONFIRMED',
        roomType: 'standard',
      }),
    });
  });

  it('creates reservation event', async () => {
    await createReservation(prisma, {
      hotelId: 'h1', guestFirstName: 'Jane', guestLastName: 'Doe',
      guestPhone: '+15551234567', checkInDate: '2026-04-01', checkOutDate: '2026-04-03',
      roomType: 'standard', roomCount: 1, guestCount: 2,
    });
    expect(prisma.reservationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'created',
        triggeredBy: 'ai_agent',
      }),
    });
  });

  it('returns PMS result', async () => {
    const result = await createReservation(prisma, {
      hotelId: 'h1', guestFirstName: 'Jane', guestLastName: 'Doe',
      guestPhone: '+15551234567', checkInDate: '2026-04-01', checkOutDate: '2026-04-03',
      roomType: 'standard', roomCount: 1, guestCount: 2,
    });
    expect(result).toEqual(pmsResult);
  });
});

describe('modifyReservation', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    mockPmsProvider.modifyReservation.mockResolvedValue({
      ...{ reservationId: 'res_1', confirmationCode: 'GP-ABC', status: 'CONFIRMED', totalPrice: 300 },
      checkOutDate: '2026-04-05',
    });
  });

  it('updates DB reservation when confirmationCode is provided', async () => {
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'res_db_1',
      checkInDate: new Date('2026-04-01'),
      checkOutDate: new Date('2026-04-03'),
      roomType: 'standard',
      guestCount: 2,
    });
    prisma.reservation.update.mockResolvedValue({ id: 'res_db_1' });
    prisma.reservationEvent.create.mockResolvedValue({ id: 're_1' });

    await modifyReservation(prisma, { confirmationCode: 'GP-ABC', checkOutDate: '2026-04-05' });

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_db_1' },
      data: expect.objectContaining({ status: 'MODIFIED' }),
    });
    expect(prisma.reservationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event: 'modified' }),
    });
  });

  it('still returns PMS result when DB reservation not found', async () => {
    prisma.reservation.findUnique.mockResolvedValue(null);

    const result = await modifyReservation(prisma, { confirmationCode: 'GP-NOPE', checkOutDate: '2026-04-05' });
    expect(result).toBeDefined();
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });
});

describe('cancelReservation', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    mockPmsProvider.cancelReservation.mockResolvedValue({ success: true, message: 'Cancelled' });
  });

  it('updates DB reservation to CANCELLED', async () => {
    prisma.reservation.findUnique.mockResolvedValue({ id: 'res_db_1', status: 'CONFIRMED' });
    prisma.reservation.update.mockResolvedValue({ id: 'res_db_1' });
    prisma.reservationEvent.create.mockResolvedValue({ id: 're_1' });

    await cancelReservation(prisma, { confirmationCode: 'GP-ABC' });

    expect(prisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'res_db_1' },
      data: { status: 'CANCELLED' },
    });
    expect(prisma.reservationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event: 'cancelled' }),
    });
  });

  it('returns PMS result when DB reservation not found', async () => {
    prisma.reservation.findUnique.mockResolvedValue(null);
    const result = await cancelReservation(prisma, { confirmationCode: 'GP-NOPE' });
    expect(result.success).toBe(true);
  });
});

describe('findReservation', () => {
  it('delegates to PMS provider', async () => {
    const expected = { reservationId: 'res_1', confirmationCode: 'GP-ABC' };
    mockPmsProvider.findReservation.mockResolvedValue(expected);

    const result = await findReservation({ confirmationCode: 'GP-ABC' });
    expect(result).toEqual(expected);
  });
});
