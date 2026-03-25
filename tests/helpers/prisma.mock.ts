import { vi } from 'vitest';

function createModelMock() {
  return {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

export function createMockPrisma() {
  return {
    hotel: createModelMock(),
    guest: createModelMock(),
    call: createModelMock(),
    callEvent: createModelMock(),
    reservation: createModelMock(),
    reservationEvent: createModelMock(),
    conversationSession: createModelMock(),
    toolLog: createModelMock(),
    handoffEvent: createModelMock(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  } as unknown as import('@prisma/client').PrismaClient & {
    hotel: ReturnType<typeof createModelMock>;
    guest: ReturnType<typeof createModelMock>;
    call: ReturnType<typeof createModelMock>;
    callEvent: ReturnType<typeof createModelMock>;
    reservation: ReturnType<typeof createModelMock>;
    reservationEvent: ReturnType<typeof createModelMock>;
    conversationSession: ReturnType<typeof createModelMock>;
    toolLog: ReturnType<typeof createModelMock>;
    handoffEvent: ReturnType<typeof createModelMock>;
  };
}

export type MockPrisma = ReturnType<typeof createMockPrisma>;
