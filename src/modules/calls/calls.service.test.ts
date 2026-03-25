import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPrisma, type MockPrisma } from '../../../tests/helpers/prisma.mock.js';

const mockSetCallSession = vi.fn();
const mockDeleteCallSession = vi.fn();

vi.mock('../../config/index.js', () => ({
  getEnv: () => ({
    DEFAULT_HOTEL_ID: 'hotel_test',
  }),
  loadEnv: () => ({}),
}));

vi.mock('../../lib/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(), child: vi.fn().mockReturnThis() }),
}));

vi.mock('../../lib/redis.js', () => ({
  setCallSession: (...args: unknown[]) => mockSetCallSession(...args),
  getCallSession: vi.fn(),
  updateCallSession: vi.fn(),
  deleteCallSession: (...args: unknown[]) => mockDeleteCallSession(...args),
  getRedis: vi.fn(),
}));

import { createCall, updateCallStatus, logToolCall } from './calls.service.js';

describe('createCall', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.guest.upsert.mockResolvedValue({ id: 'guest_1', phoneNumber: '+15551234567' });
    prisma.call.create.mockResolvedValue({ id: 'call_1', twilioCallSid: 'CA123' });
    prisma.callEvent.create.mockResolvedValue({ id: 'ce_1' });
    mockSetCallSession.mockResolvedValue(undefined);
  });

  it('upserts guest by phone number', async () => {
    await createCall(prisma, { twilioCallSid: 'CA123', callerNumber: '+15551234567' });
    expect(prisma.guest.upsert).toHaveBeenCalledWith({
      where: { phoneNumber: '+15551234567' },
      update: { totalCalls: { increment: 1 } },
      create: { phoneNumber: '+15551234567', totalCalls: 1 },
    });
  });

  it('creates call with RINGING status', async () => {
    await createCall(prisma, { twilioCallSid: 'CA123', callerNumber: '+15551234567' });
    expect(prisma.call.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        twilioCallSid: 'CA123',
        status: 'RINGING',
        guestId: 'guest_1',
      }),
    });
  });

  it('creates call event', async () => {
    await createCall(prisma, { twilioCallSid: 'CA123', callerNumber: '+15551234567' });
    expect(prisma.callEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'call.initiated',
      }),
    });
  });

  it('initializes Redis session', async () => {
    await createCall(prisma, { twilioCallSid: 'CA123', callerNumber: '+15551234567' });
    expect(mockSetCallSession).toHaveBeenCalledWith('CA123', expect.objectContaining({
      callSid: 'CA123',
      callerNumber: '+15551234567',
      hotelId: 'hotel_test',
    }));
  });

  it('uses DEFAULT_HOTEL_ID when hotelId not provided', async () => {
    await createCall(prisma, { twilioCallSid: 'CA123', callerNumber: '+15551234567' });
    expect(prisma.call.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ hotelId: 'hotel_test' }),
    });
  });

  it('returns call id', async () => {
    const id = await createCall(prisma, { twilioCallSid: 'CA123', callerNumber: '+15551234567' });
    expect(id).toBe('call_1');
  });
});

describe('updateCallStatus', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.call.findUnique.mockResolvedValue({ id: 'call_1', twilioCallSid: 'CA123' });
    prisma.call.update.mockResolvedValue({ id: 'call_1' });
    prisma.callEvent.create.mockResolvedValue({ id: 'ce_1' });
    mockDeleteCallSession.mockResolvedValue(undefined);
  });

  it('updates call status', async () => {
    await updateCallStatus(prisma, 'CA123', 'IN_PROGRESS');
    expect(prisma.call.update).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: expect.objectContaining({ status: 'IN_PROGRESS' }),
    });
  });

  it('creates call event', async () => {
    await updateCallStatus(prisma, 'CA123', 'IN_PROGRESS');
    expect(prisma.callEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callId: 'call_1',
        event: 'call.in_progress',
      }),
    });
  });

  it('sets endedAt for COMPLETED', async () => {
    await updateCallStatus(prisma, 'CA123', 'COMPLETED');
    expect(prisma.call.update).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: expect.objectContaining({
        endedAt: expect.any(Date),
      }),
    });
  });

  it('deletes Redis session for COMPLETED', async () => {
    await updateCallStatus(prisma, 'CA123', 'COMPLETED');
    expect(mockDeleteCallSession).toHaveBeenCalledWith('CA123');
  });

  it('deletes Redis session for FAILED', async () => {
    await updateCallStatus(prisma, 'CA123', 'FAILED');
    expect(mockDeleteCallSession).toHaveBeenCalledWith('CA123');
  });

  it('does NOT delete Redis session for IN_PROGRESS', async () => {
    await updateCallStatus(prisma, 'CA123', 'IN_PROGRESS');
    expect(mockDeleteCallSession).not.toHaveBeenCalled();
  });

  it('passes duration when provided', async () => {
    await updateCallStatus(prisma, 'CA123', 'COMPLETED', { duration: 120 });
    expect(prisma.call.update).toHaveBeenCalledWith({
      where: { id: 'call_1' },
      data: expect.objectContaining({ duration: 120 }),
    });
  });

  it('returns silently when call not found', async () => {
    prisma.call.findUnique.mockResolvedValue(null);
    await expect(updateCallStatus(prisma, 'UNKNOWN', 'COMPLETED')).resolves.toBeUndefined();
    expect(prisma.call.update).not.toHaveBeenCalled();
  });
});

describe('logToolCall', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.call.findUnique.mockResolvedValue({ id: 'call_1' });
    prisma.toolLog.create.mockResolvedValue({ id: 'tl_1' });
  });

  it('creates tool log entry', async () => {
    await logToolCall(prisma, 'CA123', 'check_availability', { dates: '...' }, { rooms: [] }, null, 50);
    expect(prisma.toolLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        callId: 'call_1',
        toolName: 'check_availability',
        durationMs: 50,
        error: null,
      }),
    });
  });

  it('returns silently when call not found', async () => {
    prisma.call.findUnique.mockResolvedValue(null);
    await expect(logToolCall(prisma, 'UNKNOWN', 'tool', {}, {}, null, 10)).resolves.toBeUndefined();
    expect(prisma.toolLog.create).not.toHaveBeenCalled();
  });
});
