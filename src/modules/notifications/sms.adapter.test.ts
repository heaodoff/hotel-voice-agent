import { describe, it, expect, vi, beforeEach } from 'vitest';

const testEnv = {
  NODE_ENV: 'development' as const,
  TWILIO_ACCOUNT_SID: 'ACtest00000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'test_auth_token',
  TWILIO_PHONE_NUMBER: '+10000000000',
};

vi.mock('../../config/index.js', () => ({
  getEnv: () => testEnv,
  loadEnv: () => testEnv,
}));

vi.mock('../../lib/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
}));

import { sendConfirmationSms } from './sms.adapter.js';

const validInput = {
  to: '+15551234567',
  confirmationCode: 'GP-ABC123',
  guestName: 'Jane Doe',
  hotelName: 'Test Hotel',
  checkInDate: '2026-04-01',
  checkOutDate: '2026-04-03',
  roomType: 'deluxe',
};

describe('sendConfirmationSms', () => {
  it('returns success with dev stub in development mode', async () => {
    const result = await sendConfirmationSms(validInput);
    expect(result.success).toBe(true);
    expect(result.sid).toBeDefined();
    expect(result.sid).toMatch(/^dev_stub_/);
  });

  it('does not call Twilio in development mode', async () => {
    // If Twilio were called, it would throw because credentials are fake
    const result = await sendConfirmationSms(validInput);
    expect(result.success).toBe(true);
  });
});
