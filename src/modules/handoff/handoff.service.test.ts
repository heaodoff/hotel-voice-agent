import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrisma, type MockPrisma } from '../../../tests/helpers/prisma.mock.js';

vi.mock('../../config/index.js', () => ({
  getEnv: () => ({
    HANDOFF_PHONE_NUMBER: '+10000000002',
  }),
  loadEnv: () => ({}),
}));

vi.mock('../../lib/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
}));

import { initiateHandoff } from './handoff.service.js';

describe('initiateHandoff', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.handoffEvent.create.mockResolvedValue({ id: 'he_1' });
  });

  it('creates HandoffEvent with correct reason mapping', async () => {
    const result = await initiateHandoff(prisma, 'call_1', {
      reason: 'caller_frustrated',
      description: 'guest is angry',
    });

    expect(prisma.handoffEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callId: 'call_1',
        reason: 'CALLER_FRUSTRATED',
        description: 'guest is angry',
        transferTo: '+10000000002',
        success: true,
      }),
    });
    expect(result.success).toBe(true);
    expect(result.transferTo).toBe('+10000000002');
  });

  it('maps caller_request correctly', async () => {
    await initiateHandoff(prisma, 'call_1', { reason: 'caller_request' });
    expect(prisma.handoffEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: 'CALLER_REQUEST' }),
    });
  });

  it('maps group_booking correctly', async () => {
    await initiateHandoff(prisma, 'call_1', { reason: 'group_booking' });
    expect(prisma.handoffEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: 'GROUP_BOOKING' }),
    });
  });

  it('maps all 8 reason types', async () => {
    const reasons = [
      ['caller_request', 'CALLER_REQUEST'],
      ['caller_frustrated', 'CALLER_FRUSTRATED'],
      ['group_booking', 'GROUP_BOOKING'],
      ['payment_issue', 'PAYMENT_ISSUE'],
      ['tool_failure', 'TOOL_FAILURE'],
      ['vip_request', 'VIP_REQUEST'],
      ['unsupported_request', 'UNSUPPORTED_REQUEST'],
      ['agent_uncertainty', 'AGENT_UNCERTAINTY'],
    ] as const;

    for (const [input, expected] of reasons) {
      prisma.handoffEvent.create.mockResolvedValue({ id: 'he_1' });
      await initiateHandoff(prisma, 'call_1', { reason: input });
      expect(prisma.handoffEvent.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ reason: expected }),
      });
    }
  });

  it('uses callerSummary as fallback description', async () => {
    await initiateHandoff(prisma, 'call_1', {
      reason: 'caller_request',
      callerSummary: 'asked to speak with manager',
    });
    expect(prisma.handoffEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ description: 'asked to speak with manager' }),
    });
  });

  it('returns message with reason', async () => {
    const result = await initiateHandoff(prisma, 'call_1', { reason: 'payment_issue' });
    expect(result.message).toContain('payment_issue');
  });
});
