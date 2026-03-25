import type { PrismaClient, CallStatus } from '@prisma/client';
import { createChildLogger } from '../../lib/logger.js';
import { setCallSession, deleteCallSession, type CallSessionState } from '../../lib/redis.js';
import { getEnv } from '../../config/index.js';

const logger = createChildLogger({ module: 'calls' });

export async function createCall(
  prisma: PrismaClient,
  data: {
    twilioCallSid: string;
    callerNumber: string;
    hotelId?: string;
  },
): Promise<string> {
  const env = getEnv();
  const hotelId = data.hotelId ?? env.DEFAULT_HOTEL_ID;

  // Upsert guest by phone number and increment call count
  const guest = await prisma.guest.upsert({
    where: { phoneNumber: data.callerNumber },
    update: { totalCalls: { increment: 1 } },
    create: { phoneNumber: data.callerNumber, totalCalls: 1 },
  });

  const call = await prisma.call.create({
    data: {
      twilioCallSid: data.twilioCallSid,
      hotelId,
      guestId: guest.id,
      callerNumber: data.callerNumber,
      status: 'RINGING',
    },
  });

  await prisma.callEvent.create({
    data: {
      callId: call.id,
      event: 'call.initiated',
      data: { callerNumber: data.callerNumber },
    },
  });

  // Initialize Redis session
  const session: CallSessionState = {
    callSid: data.twilioCallSid,
    hotelId,
    callerNumber: data.callerNumber,
    guestId: guest.id,
    startedAt: new Date().toISOString(),
  };
  await setCallSession(data.twilioCallSid, session);

  logger.info({ callId: call.id, callSid: data.twilioCallSid }, 'Call created');
  return call.id;
}

export async function updateCallStatus(
  prisma: PrismaClient,
  twilioCallSid: string,
  status: CallStatus,
  extra?: { duration?: number; transcriptSummary?: string },
): Promise<void> {
  const call = await prisma.call.findUnique({ where: { twilioCallSid } });
  if (!call) {
    logger.warn({ twilioCallSid }, 'Call not found for status update');
    return;
  }

  await prisma.call.update({
    where: { id: call.id },
    data: {
      status,
      ...(status === 'COMPLETED' || status === 'FAILED' ? { endedAt: new Date() } : {}),
      ...(extra?.duration != null ? { duration: extra.duration } : {}),
      ...(extra?.transcriptSummary ? { transcriptSummary: extra.transcriptSummary } : {}),
    },
  });

  await prisma.callEvent.create({
    data: {
      callId: call.id,
      event: `call.${status.toLowerCase()}`,
      data: extra ?? {},
    },
  });

  if (status === 'COMPLETED' || status === 'FAILED') {
    await deleteCallSession(twilioCallSid);
  }

  logger.info({ callId: call.id, status }, 'Call status updated');
}

export async function logToolCall(
  prisma: PrismaClient,
  callSid: string,
  toolName: string,
  input: unknown,
  output: unknown,
  error: string | null,
  durationMs: number,
): Promise<void> {
  const call = await prisma.call.findUnique({ where: { twilioCallSid: callSid } });
  if (!call) {
    logger.warn({ callSid, toolName }, 'Call not found for tool log');
    return;
  }

  await prisma.toolLog.create({
    data: {
      callId: call.id,
      toolName,
      input: input as object,
      output: output as object ?? null,
      error,
      durationMs,
    },
  });
}

/**
 * Build guest context string for returning callers.
 * Injected into the AI system prompt so the agent recognizes repeat guests.
 */
export async function getGuestContext(
  prisma: PrismaClient,
  phoneNumber: string,
): Promise<string> {
  const guest = await prisma.guest.findUnique({
    where: { phoneNumber },
    include: {
      reservations: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          confirmationCode: true,
          status: true,
          checkInDate: true,
          checkOutDate: true,
          roomType: true,
          totalPrice: true,
        },
      },
    },
  });

  if (!guest || !guest.firstName) return '';

  const lines: string[] = [
    '## Returning Guest Context',
    `This is a returning caller. Their name is ${guest.firstName}${guest.lastName ? ' ' + guest.lastName : ''}.`,
    `They have called ${guest.totalCalls} time(s) before.`,
    `Preferred language: ${guest.language ?? 'unknown'}.`,
  ];

  if (guest.email) {
    lines.push(`Email on file: ${guest.email}.`);
  }

  if (guest.reservations.length > 0) {
    lines.push('Recent reservations:');
    for (const res of guest.reservations) {
      const status = res.status;
      const code = res.confirmationCode ?? 'N/A';
      const checkIn = res.checkInDate instanceof Date ? res.checkInDate.toISOString().split('T')[0] : String(res.checkInDate);
      const checkOut = res.checkOutDate instanceof Date ? res.checkOutDate.toISOString().split('T')[0] : String(res.checkOutDate);
      lines.push(`  - ${code} (${status}): ${checkIn} to ${checkOut}, ${res.roomType}, $${res.totalPrice}`);
    }
  }

  lines.push('Use their name naturally in conversation. If they have active reservations, proactively ask if they are calling about one of them.');

  return lines.join('\n');
}

export async function getRecentCalls(
  prisma: PrismaClient,
  limit: number = 20,
) {
  return prisma.call.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      guest: true,
      toolLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      handoffs: true,
      _count: { select: { events: true, toolLogs: true } },
    },
  });
}
