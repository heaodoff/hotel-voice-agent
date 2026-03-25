import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
}));

const mockSendSms = vi.fn();
const mockSendEmail = vi.fn();

vi.mock('./sms.adapter.js', () => ({
  sendConfirmationSms: (...args: unknown[]) => mockSendSms(...args),
}));

vi.mock('./email.adapter.js', () => ({
  sendConfirmationEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { sendReservationConfirmationSms, sendReservationConfirmationEmail } from './notifications.service.js';

const smsInput = {
  to: '+15551234567',
  confirmationCode: 'GP-ABC',
  guestName: 'John',
  hotelName: 'Test Hotel',
  checkInDate: '2026-04-01',
  checkOutDate: '2026-04-03',
  roomType: 'deluxe',
};

const emailInput = {
  to: 'john@example.com',
  confirmationCode: 'GP-ABC',
  guestName: 'John',
  hotelName: 'Test Hotel',
  checkInDate: '2026-04-01',
  checkOutDate: '2026-04-03',
  roomType: 'deluxe',
  currency: 'USD',
};

describe('sendReservationConfirmationSms', () => {
  it('returns success message on success', async () => {
    mockSendSms.mockResolvedValue({ success: true, sid: 'SM123' });
    const result = await sendReservationConfirmationSms(smsInput);
    expect(result.success).toBe(true);
    expect(result.message).toContain(smsInput.to);
  });

  it('returns failure message on failure', async () => {
    mockSendSms.mockResolvedValue({ success: false });
    const result = await sendReservationConfirmationSms(smsInput);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed');
  });
});

describe('sendReservationConfirmationEmail', () => {
  it('returns success message on success', async () => {
    mockSendEmail.mockResolvedValue({ success: true, messageId: 'msg_1' });
    const result = await sendReservationConfirmationEmail(emailInput);
    expect(result.success).toBe(true);
    expect(result.message).toContain(emailInput.to);
  });

  it('returns failure message on failure', async () => {
    mockSendEmail.mockResolvedValue({ success: false });
    const result = await sendReservationConfirmationEmail(emailInput);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed');
  });
});
