import type { PrismaClient } from '@prisma/client';

interface DashboardParams {
  hotelId?: string;
  period: 'day' | 'week' | 'month';
}

export async function getDashboardMetrics(prisma: PrismaClient, params: DashboardParams) {
  const now = new Date();
  const startDate = new Date(now);

  if (params.period === 'day') startDate.setDate(now.getDate() - 1);
  else if (params.period === 'week') startDate.setDate(now.getDate() - 7);
  else startDate.setMonth(now.getMonth() - 1);

  const hotelFilter = params.hotelId ? { hotelId: params.hotelId } : {};

  const [
    totalCalls,
    completedCalls,
    calls,
    totalReservations,
    reservations,
    handoffs,
    languageCounts,
    toolLogs,
  ] = await Promise.all([
    prisma.call.count({ where: { ...hotelFilter, startedAt: { gte: startDate } } }),
    prisma.call.count({ where: { ...hotelFilter, status: 'COMPLETED', startedAt: { gte: startDate } } }),
    prisma.call.findMany({
      where: { ...hotelFilter, startedAt: { gte: startDate } },
      select: { duration: true, startedAt: true, status: true },
    }),
    prisma.reservation.count({ where: { ...hotelFilter, createdAt: { gte: startDate } } }),
    prisma.reservation.findMany({
      where: { ...hotelFilter, createdAt: { gte: startDate } },
      select: { totalPrice: true },
    }),
    prisma.handoffEvent.findMany({
      where: { call: { ...hotelFilter, startedAt: { gte: startDate } } },
      select: { reason: true },
    }),
    prisma.call.groupBy({
      by: ['language'],
      where: { ...hotelFilter, startedAt: { gte: startDate }, language: { not: null } },
      _count: true,
    }),
    prisma.toolLog.findMany({
      where: { call: { ...hotelFilter, startedAt: { gte: startDate } } },
      select: { toolName: true, durationMs: true, error: true },
    }),
  ]);

  // Average duration
  const durationsMs = calls.filter(c => c.duration != null).map(c => c.duration!);
  const averageDuration = durationsMs.length > 0
    ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length)
    : 0;

  // Revenue
  const revenue = reservations.reduce((sum, r) => sum + (r.totalPrice ? Number(r.totalPrice) : 0), 0);

  // Handoff rate
  const handoffRate = totalCalls > 0 ? Math.round((handoffs.length / totalCalls) * 100) / 100 : 0;

  // Calls by day
  const callsByDay = new Map<string, number>();
  for (const call of calls) {
    const day = call.startedAt.toISOString().split('T')[0]!;
    callsByDay.set(day, (callsByDay.get(day) ?? 0) + 1);
  }

  // Top languages
  const topLanguages = languageCounts
    .map(l => ({ lang: l.language ?? 'unknown', count: l._count }))
    .sort((a, b) => b.count - a.count);

  // Handoff reasons
  const reasonCounts = new Map<string, number>();
  for (const h of handoffs) {
    reasonCounts.set(h.reason, (reasonCounts.get(h.reason) ?? 0) + 1);
  }

  // Tool performance
  const toolStats = new Map<string, { totalMs: number; count: number; errors: number }>();
  for (const log of toolLogs) {
    const existing = toolStats.get(log.toolName) ?? { totalMs: 0, count: 0, errors: 0 };
    existing.count++;
    existing.totalMs += log.durationMs ?? 0;
    if (log.error) existing.errors++;
    toolStats.set(log.toolName, existing);
  }

  return {
    totalCalls,
    completedCalls,
    averageDuration,
    totalReservations,
    revenue: Math.round(revenue * 100) / 100,
    handoffRate,
    topLanguages,
    callsByDay: Array.from(callsByDay.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    handoffReasons: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })),
    toolPerformance: Array.from(toolStats.entries()).map(([tool, stats]) => ({
      tool,
      avgMs: Math.round(stats.totalMs / stats.count),
      errorRate: Math.round((stats.errors / stats.count) * 100) / 100,
      count: stats.count,
    })),
  };
}

export async function getFilteredCalls(
  prisma: PrismaClient,
  filters: {
    hotelId?: string;
    status?: string;
    language?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);

  const where: Record<string, unknown> = {};
  if (filters.hotelId) where['hotelId'] = filters.hotelId;
  if (filters.status) where['status'] = filters.status;
  if (filters.language) where['language'] = filters.language;
  if (filters.from || filters.to) {
    where['startedAt'] = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        guest: { select: { firstName: true, lastName: true, phoneNumber: true } },
        hotel: { select: { name: true } },
        _count: { select: { toolLogs: true, handoffs: true } },
      },
    }),
    prisma.call.count({ where }),
  ]);

  return { calls, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCallTimeline(prisma: PrismaClient, callSid: string) {
  const call = await prisma.call.findUnique({
    where: { twilioCallSid: callSid },
    include: {
      guest: true,
      hotel: { select: { name: true } },
      events: { orderBy: { createdAt: 'asc' } },
      toolLogs: { orderBy: { createdAt: 'asc' } },
      handoffs: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!call) return null;

  // Merge events and tool logs into a timeline
  type TimelineEntry = { time: string; type: string; data: unknown };
  const timeline: TimelineEntry[] = [];

  for (const event of call.events) {
    timeline.push({
      time: event.createdAt.toISOString(),
      type: 'event',
      data: { event: event.event, ...((event.data ?? {}) as object) },
    });
  }

  for (const log of call.toolLogs) {
    timeline.push({
      time: log.createdAt.toISOString(),
      type: 'tool',
      data: { toolName: log.toolName, durationMs: log.durationMs, error: log.error, input: log.input, output: log.output },
    });
  }

  for (const handoff of call.handoffs) {
    timeline.push({
      time: handoff.createdAt.toISOString(),
      type: 'handoff',
      data: { reason: handoff.reason, description: handoff.description, transferTo: handoff.transferTo, success: handoff.success, conversationSummary: handoff.conversationSummary },
    });
  }

  timeline.sort((a, b) => a.time.localeCompare(b.time));

  return {
    call: {
      id: call.id,
      callSid: call.twilioCallSid,
      status: call.status,
      duration: call.duration,
      language: call.language,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      transcriptSummary: call.transcriptSummary,
      recordingUrl: call.recordingUrl,
      hotelName: call.hotel.name,
      guest: call.guest,
    },
    timeline,
  };
}

export async function searchGuests(prisma: PrismaClient, query: string, limit = 20) {
  return prisma.guest.findMany({
    where: {
      OR: [
        { phoneNumber: { contains: query } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { calls: true, reservations: true } },
    },
  });
}
