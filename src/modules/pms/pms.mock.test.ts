import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
}));

import { MockPmsProvider } from './pms.mock.js';

describe('MockPmsProvider', () => {
  let pms: MockPmsProvider;

  beforeEach(() => {
    pms = new MockPmsProvider();
  });

  describe('seeded data', () => {
    it('has seeded reservation GP-TEST01', async () => {
      const res = await pms.findReservation({ confirmationCode: 'GP-TEST01' });
      expect(res).not.toBeNull();
      expect(res!.guestName).toBe('John Smith');
      expect(res!.roomType).toBe('deluxe');
      expect(res!.totalPrice).toBe(398);
      expect(res!.status).toBe('CONFIRMED');
    });

    it('returns null for non-existent reservation', async () => {
      const res = await pms.findReservation({ confirmationCode: 'NOPE' });
      expect(res).toBeNull();
    });
  });

  describe('checkAvailability', () => {
    it('calculates correct number of nights', async () => {
      const result = await pms.checkAvailability({
        hotelId: 'h1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03', guestCount: 1,
      });
      expect(result.nights).toBe(2);
    });

    it('returns all 5 room types when no filter', async () => {
      const result = await pms.checkAvailability({
        hotelId: 'h1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03', guestCount: 1,
      });
      expect(result.rooms).toHaveLength(5);
      const types = result.rooms.map(r => r.roomType);
      expect(types).toContain('standard');
      expect(types).toContain('penthouse');
    });

    it('filters to single room type when specified', async () => {
      const result = await pms.checkAvailability({
        hotelId: 'h1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03', roomType: 'suite', guestCount: 1,
      });
      expect(result.rooms).toHaveLength(1);
      expect(result.rooms[0]!.roomType).toBe('suite');
    });

    it('returns hotelId matching input', async () => {
      const result = await pms.checkAvailability({
        hotelId: 'hotel_xyz', checkInDate: '2026-04-01', checkOutDate: '2026-04-03', guestCount: 1,
      });
      expect(result.hotelId).toBe('hotel_xyz');
    });

    it('each room has currency USD', async () => {
      const result = await pms.checkAvailability({
        hotelId: 'h1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03', guestCount: 1,
      });
      for (const room of result.rooms) {
        expect(room.currency).toBe('USD');
        expect(room.ratePerNight).toBeGreaterThan(0);
      }
    });
  });

  describe('getRates', () => {
    it('returns correct base rate for standard on weekday', async () => {
      // 2026-04-06 is a Monday
      const rates = await pms.getRates({ hotelId: 'h1', checkInDate: '2026-04-06', checkOutDate: '2026-04-08' });
      const standard = rates.find(r => r.roomType === 'standard');
      expect(standard).toBeDefined();
      expect(standard!.ratePerNight).toBe(129);
      expect(standard!.nights).toBe(2);
      expect(standard!.totalPrice).toBe(258);
    });

    it('applies 1.2x weekend multiplier on Friday', async () => {
      // 2026-04-03 is a Friday
      const rates = await pms.getRates({ hotelId: 'h1', checkInDate: '2026-04-03', checkOutDate: '2026-04-04' });
      const standard = rates.find(r => r.roomType === 'standard');
      expect(standard!.ratePerNight).toBe(Math.round(129 * 1.2));
    });

    it('applies 1.2x weekend multiplier on Saturday', async () => {
      // 2026-04-04 is a Saturday
      const rates = await pms.getRates({ hotelId: 'h1', checkInDate: '2026-04-04', checkOutDate: '2026-04-05' });
      const standard = rates.find(r => r.roomType === 'standard');
      expect(standard!.ratePerNight).toBe(Math.round(129 * 1.2));
    });

    it('filters by roomType', async () => {
      const rates = await pms.getRates({ hotelId: 'h1', checkInDate: '2026-04-06', checkOutDate: '2026-04-08', roomType: 'penthouse' });
      expect(rates).toHaveLength(1);
      expect(rates[0]!.roomType).toBe('penthouse');
      expect(rates[0]!.ratePerNight).toBe(599);
    });
  });

  describe('createReservation', () => {
    const validInput = {
      hotelId: 'h1',
      guestFirstName: 'Jane',
      guestLastName: 'Doe',
      guestPhone: '+15559999999',
      checkInDate: '2026-05-01',
      checkOutDate: '2026-05-03',
      roomType: 'standard' as const,
      roomCount: 1,
      guestCount: 2,
    };

    it('returns confirmed reservation with confirmation code', async () => {
      const result = await pms.createReservation(validInput);
      expect(result.status).toBe('CONFIRMED');
      expect(result.confirmationCode).toMatch(/^GP-/);
      expect(result.reservationId).toBeTruthy();
      expect(result.guestName).toBe('Jane Doe');
    });

    it('stores reservation findable by confirmation code', async () => {
      const result = await pms.createReservation(validInput);
      const found = await pms.findReservation({ confirmationCode: result.confirmationCode });
      expect(found).not.toBeNull();
      expect(found!.reservationId).toBe(result.reservationId);
    });

    it('throws for past check-in date', async () => {
      await expect(pms.createReservation({ ...validInput, checkInDate: '2020-01-01' }))
        .rejects.toThrow('Check-in date cannot be in the past');
    });

    it('calculates total price correctly', async () => {
      // 2 nights * $129 (weekday) * 1 room
      // 2026-05-01 is a Friday, so rate = 129 * 1.2 = 155
      const result = await pms.createReservation(validInput);
      expect(result.totalPrice).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
    });
  });

  describe('modifyReservation', () => {
    it('modifies dates on existing reservation', async () => {
      const result = await pms.modifyReservation({
        confirmationCode: 'GP-TEST01',
        checkOutDate: '2026-04-05',
      });
      expect(result.checkOutDate).toBe('2026-04-05');
    });

    it('throws NotFoundError for non-existent reservation', async () => {
      await expect(pms.modifyReservation({ confirmationCode: 'NOPE' }))
        .rejects.toThrow('not found');
    });

    it('throws PmsError when modifying cancelled reservation', async () => {
      await pms.cancelReservation({ confirmationCode: 'GP-TEST01' });
      await expect(pms.modifyReservation({ confirmationCode: 'GP-TEST01', checkOutDate: '2026-04-05' }))
        .rejects.toThrow('cancelled');
    });
  });

  describe('cancelReservation', () => {
    it('cancels an existing reservation', async () => {
      const result = await pms.cancelReservation({ confirmationCode: 'GP-TEST01' });
      expect(result.success).toBe(true);
    });

    it('returns success for already cancelled reservation', async () => {
      await pms.cancelReservation({ confirmationCode: 'GP-TEST01' });
      const result = await pms.cancelReservation({ confirmationCode: 'GP-TEST01' });
      expect(result.success).toBe(true);
      expect(result.message).toContain('already cancelled');
    });

    it('throws NotFoundError for non-existent reservation', async () => {
      await expect(pms.cancelReservation({ confirmationCode: 'NOPE' }))
        .rejects.toThrow('not found');
    });
  });

  describe('findReservation', () => {
    it('finds by guestPhone', async () => {
      const res = await pms.findReservation({ guestPhone: '+15551234567' });
      expect(res).not.toBeNull();
      expect(res!.confirmationCode).toBe('GP-TEST01');
    });

    it('returns null for unknown phone', async () => {
      const res = await pms.findReservation({ guestPhone: '+10000000000' });
      expect(res).toBeNull();
    });
  });
});
