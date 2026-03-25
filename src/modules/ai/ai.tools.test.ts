import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrisma, type MockPrisma } from '../../../tests/helpers/prisma.mock.js';

vi.mock('../../lib/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
}));

const mockCheckAvailability = vi.fn();
const mockGetRoomRates = vi.fn();
const mockCreateReservation = vi.fn();
const mockModifyReservation = vi.fn();
const mockCancelReservation = vi.fn();
const mockFindReservation = vi.fn();

vi.mock('../reservations/index.js', () => ({
  checkAvailability: (...args: unknown[]) => mockCheckAvailability(...args),
  getRoomRates: (...args: unknown[]) => mockGetRoomRates(...args),
  createReservation: (...args: unknown[]) => mockCreateReservation(...args),
  modifyReservation: (...args: unknown[]) => mockModifyReservation(...args),
  cancelReservation: (...args: unknown[]) => mockCancelReservation(...args),
  findReservation: (...args: unknown[]) => mockFindReservation(...args),
}));

const mockSendSms = vi.fn();
const mockSendEmail = vi.fn();

vi.mock('../notifications/index.js', () => ({
  sendReservationConfirmationSms: (...args: unknown[]) => mockSendSms(...args),
  sendReservationConfirmationEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockInitiateHandoff = vi.fn();

vi.mock('../handoff/index.js', () => ({
  initiateHandoff: (...args: unknown[]) => mockInitiateHandoff(...args),
}));

const mockLogToolCall = vi.fn();

vi.mock('../calls/index.js', () => ({
  logToolCall: (...args: unknown[]) => mockLogToolCall(...args),
}));

import { toolDefinitions, createToolHandlers } from './ai.tools.js';

describe('toolDefinitions', () => {
  it('has 9 tool definitions', () => {
    expect(toolDefinitions).toHaveLength(9);
  });

  it('all tools have name, description, and parameters', () => {
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
    }
  });

  it('includes all expected tool names', () => {
    const names = toolDefinitions.map(t => t.name);
    expect(names).toContain('check_availability');
    expect(names).toContain('get_room_rates');
    expect(names).toContain('create_reservation');
    expect(names).toContain('modify_reservation');
    expect(names).toContain('cancel_reservation');
    expect(names).toContain('find_reservation');
    expect(names).toContain('send_confirmation_sms');
    expect(names).toContain('send_confirmation_email');
    expect(names).toContain('transfer_to_human');
  });
});

describe('createToolHandlers', () => {
  let prisma: MockPrisma;
  let handlers: Record<string, (args: unknown) => Promise<unknown>>;

  beforeEach(() => {
    prisma = createMockPrisma();
    // Setup mock for logToolCall (finds call, creates log)
    prisma.call.findUnique.mockResolvedValue({ id: 'call_1' });
    prisma.toolLog.create.mockResolvedValue({ id: 'tl_1' });
    mockLogToolCall.mockResolvedValue(undefined);

    handlers = createToolHandlers(prisma, 'CA123', 'call_1', 'hotel_test');
  });

  it('returns all 9 handlers', () => {
    expect(Object.keys(handlers)).toHaveLength(9);
  });

  it('each handler is a function', () => {
    for (const handler of Object.values(handlers)) {
      expect(typeof handler).toBe('function');
    }
  });

  describe('check_availability handler', () => {
    it('calls checkAvailability with hotelId injected', async () => {
      mockCheckAvailability.mockResolvedValue({ rooms: [] });
      await handlers['check_availability']!({
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
      });
      expect(mockCheckAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ hotelId: 'hotel_test', checkInDate: '2026-04-01' }),
        prisma,
      );
    });

    it('logs tool call on success', async () => {
      mockCheckAvailability.mockResolvedValue({ rooms: [] });
      await handlers['check_availability']!({
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
      });
      expect(mockLogToolCall).toHaveBeenCalledWith(
        prisma, 'CA123', 'check_availability',
        expect.anything(), expect.anything(), null, expect.any(Number),
      );
    });

    it('returns error object on Zod validation failure', async () => {
      const result = await handlers['check_availability']!({
        checkInDate: 'bad-date',
      });
      expect(result).toHaveProperty('error', true);
      expect(result).toHaveProperty('message');
    });
  });

  describe('get_room_rates handler', () => {
    it('calls getRoomRates with hotelId injected', async () => {
      mockGetRoomRates.mockResolvedValue([]);
      await handlers['get_room_rates']!({
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
      });
      expect(mockGetRoomRates).toHaveBeenCalledWith(
        expect.objectContaining({ hotelId: 'hotel_test' }),
        prisma,
      );
    });
  });

  describe('create_reservation handler', () => {
    it('calls createReservation with prisma and hotelId', async () => {
      mockCreateReservation.mockResolvedValue({ confirmationCode: 'GP-X' });
      await handlers['create_reservation']!({
        guestFirstName: 'Jane',
        guestLastName: 'Doe',
        guestPhone: '+15551234567',
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
        roomType: 'standard',
      });
      expect(mockCreateReservation).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ hotelId: 'hotel_test', guestFirstName: 'Jane' }),
      );
    });
  });

  describe('modify_reservation handler', () => {
    it('calls modifyReservation', async () => {
      mockModifyReservation.mockResolvedValue({ status: 'CONFIRMED' });
      await handlers['modify_reservation']!({
        confirmationCode: 'GP-ABC',
        checkOutDate: '2026-04-05',
      });
      expect(mockModifyReservation).toHaveBeenCalled();
    });
  });

  describe('cancel_reservation handler', () => {
    it('calls cancelReservation', async () => {
      mockCancelReservation.mockResolvedValue({ success: true, message: 'Cancelled' });
      await handlers['cancel_reservation']!({
        confirmationCode: 'GP-ABC',
      });
      expect(mockCancelReservation).toHaveBeenCalled();
    });
  });

  describe('find_reservation handler', () => {
    it('calls findReservation', async () => {
      mockFindReservation.mockResolvedValue({ confirmationCode: 'GP-ABC' });
      await handlers['find_reservation']!({
        confirmationCode: 'GP-ABC',
      });
      expect(mockFindReservation).toHaveBeenCalled();
    });
  });

  describe('send_confirmation_sms handler', () => {
    it('calls sendReservationConfirmationSms', async () => {
      mockSendSms.mockResolvedValue({ success: true, message: 'Sent' });
      await handlers['send_confirmation_sms']!({
        to: '+15551234567',
        confirmationCode: 'GP-ABC',
        guestName: 'Jane',
        hotelName: 'Test Hotel',
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
        roomType: 'deluxe',
      });
      expect(mockSendSms).toHaveBeenCalled();
    });
  });

  describe('send_confirmation_email handler', () => {
    it('calls sendReservationConfirmationEmail', async () => {
      mockSendEmail.mockResolvedValue({ success: true, message: 'Sent' });
      await handlers['send_confirmation_email']!({
        to: 'jane@example.com',
        confirmationCode: 'GP-ABC',
        guestName: 'Jane',
        hotelName: 'Test Hotel',
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
        roomType: 'deluxe',
      });
      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  describe('transfer_to_human handler', () => {
    it('calls initiateHandoff with callId', async () => {
      mockInitiateHandoff.mockResolvedValue({ success: true, transferTo: '+1000', message: 'Transferred' });
      await handlers['transfer_to_human']!({
        reason: 'caller_request',
        description: 'wants human',
      });
      expect(mockInitiateHandoff).toHaveBeenCalledWith(
        prisma, 'call_1', expect.objectContaining({ reason: 'caller_request' }), 'CA123',
      );
    });
  });

  describe('executeWithLogging error handling', () => {
    it('returns error object instead of throwing', async () => {
      mockCheckAvailability.mockRejectedValue(new Error('PMS down'));
      const result = await handlers['check_availability']!({
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
      });
      expect(result).toHaveProperty('error', true);
      expect(result).toHaveProperty('message', 'PMS down');
    });

    it('logs error via logToolCall', async () => {
      mockCheckAvailability.mockRejectedValue(new Error('timeout'));
      await handlers['check_availability']!({
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
      });
      expect(mockLogToolCall).toHaveBeenCalledWith(
        prisma, 'CA123', 'check_availability',
        expect.anything(), null, 'timeout', expect.any(Number),
      );
    });
  });
});
