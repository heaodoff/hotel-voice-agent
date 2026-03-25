import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
}));

import { sendConfirmationEmail } from './email.adapter.js';

describe('sendConfirmationEmail', () => {
  const validInput = {
    to: 'guest@example.com',
    confirmationCode: 'GP-ABC123',
    guestName: 'Jane Doe',
    hotelName: 'Test Hotel',
    checkInDate: '2026-04-01',
    checkOutDate: '2026-04-03',
    roomType: 'deluxe',
    currency: 'USD',
  };

  it('returns success', async () => {
    const result = await sendConfirmationEmail(validInput);
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageId).toMatch(/^stub_/);
  });

  it('works with optional totalPrice', async () => {
    const result = await sendConfirmationEmail({ ...validInput, totalPrice: 398 });
    expect(result.success).toBe(true);
  });

  it('works without totalPrice', async () => {
    const result = await sendConfirmationEmail(validInput);
    expect(result.success).toBe(true);
  });
});
