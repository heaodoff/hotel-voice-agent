import { vi } from 'vitest';

const noopFn = vi.fn();

export const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

export function setupLoggerMock() {
  vi.mock('../../src/lib/logger.js', () => ({
    getLogger: () => mockLogger,
    createChildLogger: () => mockLogger,
  }));
}
