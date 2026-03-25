import { describe, it, expect } from 'vitest';
import {
  checkAvailabilityInputSchema,
  getRatesInputSchema,
  createReservationInputSchema,
  modifyReservationInputSchema,
  cancelReservationInputSchema,
  findReservationInputSchema,
  sendSmsInputSchema,
  sendEmailInputSchema,
  transferToHumanInputSchema,
  dateStringSchema,
} from './types.js';

describe('dateStringSchema', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(dateStringSchema.parse('2026-04-01')).toBe('2026-04-01');
  });

  it('rejects wrong format', () => {
    expect(() => dateStringSchema.parse('04/01/2026')).toThrow();
    expect(() => dateStringSchema.parse('2026-4-1')).toThrow();
    expect(() => dateStringSchema.parse('')).toThrow();
  });
});

describe('checkAvailabilityInputSchema', () => {
  const valid = { hotelId: 'h1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03' };

  it('accepts valid input', () => {
    const result = checkAvailabilityInputSchema.parse(valid);
    expect(result.hotelId).toBe('h1');
    expect(result.guestCount).toBe(1); // default
  });

  it('accepts with optional roomType', () => {
    const result = checkAvailabilityInputSchema.parse({ ...valid, roomType: 'suite' });
    expect(result.roomType).toBe('suite');
  });

  it('rejects guestCount > 20', () => {
    expect(() => checkAvailabilityInputSchema.parse({ ...valid, guestCount: 21 })).toThrow();
  });

  it('rejects guestCount < 1', () => {
    expect(() => checkAvailabilityInputSchema.parse({ ...valid, guestCount: 0 })).toThrow();
  });

  it('rejects invalid date format', () => {
    expect(() => checkAvailabilityInputSchema.parse({ ...valid, checkInDate: 'bad' })).toThrow();
  });

  it('rejects invalid room type', () => {
    expect(() => checkAvailabilityInputSchema.parse({ ...valid, roomType: 'mansion' })).toThrow();
  });
});

describe('getRatesInputSchema', () => {
  it('accepts valid input', () => {
    const result = getRatesInputSchema.parse({ hotelId: 'h1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03' });
    expect(result.hotelId).toBe('h1');
  });

  it('accepts with optional roomType', () => {
    const result = getRatesInputSchema.parse({ hotelId: 'h1', checkInDate: '2026-04-01', checkOutDate: '2026-04-03', roomType: 'deluxe' });
    expect(result.roomType).toBe('deluxe');
  });
});

describe('createReservationInputSchema', () => {
  const valid = {
    hotelId: 'h1',
    guestFirstName: 'John',
    guestLastName: 'Doe',
    guestPhone: '+15551234567',
    checkInDate: '2026-04-01',
    checkOutDate: '2026-04-03',
    roomType: 'standard' as const,
  };

  it('accepts valid input with defaults', () => {
    const result = createReservationInputSchema.parse(valid);
    expect(result.roomCount).toBe(1);
    expect(result.guestCount).toBe(1);
  });

  it('rejects empty guestFirstName', () => {
    expect(() => createReservationInputSchema.parse({ ...valid, guestFirstName: '' })).toThrow();
  });

  it('rejects empty guestLastName', () => {
    expect(() => createReservationInputSchema.parse({ ...valid, guestLastName: '' })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => createReservationInputSchema.parse({ ...valid, guestEmail: 'notanemail' })).toThrow();
  });

  it('accepts valid email', () => {
    const result = createReservationInputSchema.parse({ ...valid, guestEmail: 'john@example.com' });
    expect(result.guestEmail).toBe('john@example.com');
  });

  it('rejects roomCount > 10', () => {
    expect(() => createReservationInputSchema.parse({ ...valid, roomCount: 11 })).toThrow();
  });
});

describe('modifyReservationInputSchema', () => {
  it('accepts with reservationId', () => {
    const result = modifyReservationInputSchema.parse({ reservationId: 'res_1' });
    expect(result.reservationId).toBe('res_1');
  });

  it('accepts with confirmationCode', () => {
    const result = modifyReservationInputSchema.parse({ confirmationCode: 'GP-ABC123' });
    expect(result.confirmationCode).toBe('GP-ABC123');
  });

  it('accepts with guestPhone', () => {
    const result = modifyReservationInputSchema.parse({ guestPhone: '+15551234567' });
    expect(result.guestPhone).toBe('+15551234567');
  });

  it('rejects when no identifier provided', () => {
    expect(() => modifyReservationInputSchema.parse({ checkInDate: '2026-05-01' })).toThrow();
  });
});

describe('cancelReservationInputSchema', () => {
  it('accepts with confirmationCode', () => {
    const result = cancelReservationInputSchema.parse({ confirmationCode: 'GP-X', reason: 'changed plans' });
    expect(result.confirmationCode).toBe('GP-X');
  });

  it('rejects with no identifiers', () => {
    expect(() => cancelReservationInputSchema.parse({ reason: 'nope' })).toThrow();
  });
});

describe('findReservationInputSchema', () => {
  it('accepts with confirmationCode', () => {
    const result = findReservationInputSchema.parse({ confirmationCode: 'GP-TEST01' });
    expect(result.confirmationCode).toBe('GP-TEST01');
  });

  it('accepts with guestLastName', () => {
    const result = findReservationInputSchema.parse({ guestLastName: 'Smith' });
    expect(result.guestLastName).toBe('Smith');
  });

  it('rejects with no search criteria', () => {
    expect(() => findReservationInputSchema.parse({})).toThrow();
  });
});

describe('sendSmsInputSchema', () => {
  const valid = {
    to: '+15551234567',
    confirmationCode: 'GP-ABC',
    guestName: 'John',
    hotelName: 'Test Hotel',
    checkInDate: '2026-04-01',
    checkOutDate: '2026-04-03',
    roomType: 'deluxe',
  };

  it('accepts valid input', () => {
    expect(sendSmsInputSchema.parse(valid)).toEqual(valid);
  });

  it('rejects missing to', () => {
    const { to, ...rest } = valid;
    expect(() => sendSmsInputSchema.parse(rest)).toThrow();
  });
});

describe('sendEmailInputSchema', () => {
  const valid = {
    to: 'john@example.com',
    confirmationCode: 'GP-ABC',
    guestName: 'John',
    hotelName: 'Test Hotel',
    checkInDate: '2026-04-01',
    checkOutDate: '2026-04-03',
    roomType: 'deluxe',
  };

  it('accepts valid input with default currency', () => {
    const result = sendEmailInputSchema.parse(valid);
    expect(result.currency).toBe('USD');
  });

  it('rejects invalid email', () => {
    expect(() => sendEmailInputSchema.parse({ ...valid, to: 'notanemail' })).toThrow();
  });
});

describe('transferToHumanInputSchema', () => {
  it('accepts each valid reason', () => {
    const reasons = [
      'caller_request', 'caller_frustrated', 'group_booking',
      'payment_issue', 'tool_failure', 'vip_request',
      'unsupported_request', 'agent_uncertainty',
    ];
    for (const reason of reasons) {
      expect(transferToHumanInputSchema.parse({ reason })).toHaveProperty('reason', reason);
    }
  });

  it('rejects invalid reason', () => {
    expect(() => transferToHumanInputSchema.parse({ reason: 'bored' })).toThrow();
  });

  it('accepts optional description and callerSummary', () => {
    const result = transferToHumanInputSchema.parse({
      reason: 'caller_request',
      description: 'wants human',
      callerSummary: 'asked about group booking',
    });
    expect(result.description).toBe('wants human');
  });
});
