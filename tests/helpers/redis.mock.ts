import { vi } from 'vitest';

export const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  connect: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
};

export const mockSetCallSession = vi.fn();
export const mockGetCallSession = vi.fn();
export const mockUpdateCallSession = vi.fn();
export const mockDeleteCallSession = vi.fn();

export function setupRedisMock() {
  vi.mock('../../src/lib/redis.js', () => ({
    getRedis: () => mockRedis,
    connectRedis: vi.fn().mockResolvedValue(mockRedis),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    setCallSession: mockSetCallSession,
    getCallSession: mockGetCallSession,
    updateCallSession: mockUpdateCallSession,
    deleteCallSession: mockDeleteCallSession,
  }));
}
