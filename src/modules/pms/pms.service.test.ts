import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
}));

import { getPmsProvider, setPmsProvider } from './pms.service.js';
import type { PmsProvider } from './pms.interface.js';

describe('PMS Service', () => {
  it('getPmsProvider returns a provider with name property', () => {
    const provider = getPmsProvider();
    expect(provider.name).toBe('mock');
  });

  it('setPmsProvider replaces the provider', () => {
    const custom: PmsProvider = {
      name: 'custom',
      checkAvailability: vi.fn(),
      getRates: vi.fn(),
      createReservation: vi.fn(),
      modifyReservation: vi.fn(),
      cancelReservation: vi.fn(),
      findReservation: vi.fn(),
    };

    setPmsProvider(custom);
    expect(getPmsProvider().name).toBe('custom');
  });
});
