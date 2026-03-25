import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../lib/logger.js';

const logger = createChildLogger({ module: 'billing' });

export interface BillingPlan {
  name: string;
  monthlyPrice: number;
  includedMinutes: number;
  pricePerMinute: number;
}

export const BILLING_PLANS: Record<string, BillingPlan> = {
  starter: { name: 'Starter', monthlyPrice: 299, includedMinutes: 500, pricePerMinute: 0.20 },
  growth: { name: 'Growth', monthlyPrice: 499, includedMinutes: 1500, pricePerMinute: 0.15 },
  enterprise: { name: 'Enterprise', monthlyPrice: 999, includedMinutes: 5000, pricePerMinute: 0.10 },
};

function getMonthBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Get or create the usage record for a hotel's current billing period.
 */
export async function getCurrentUsage(prisma: PrismaClient, hotelId: string) {
  const { start, end } = getMonthBounds(new Date());

  let record = await prisma.usageRecord.findUnique({
    where: { hotelId_periodStart: { hotelId, periodStart: start } },
  });

  if (!record) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { includedMinutes: true, monthlyPrice: true, pricePerMinute: true, billingPlan: true },
    });

    record = await prisma.usageRecord.create({
      data: {
        hotelId,
        periodStart: start,
        periodEnd: end,
        includedMinutes: hotel?.includedMinutes ?? 500,
        totalCost: hotel?.monthlyPrice ?? 299,
      },
    });
  }

  return record;
}

/**
 * Recalculate usage from actual call data for a given period.
 * Called periodically or on-demand.
 */
export async function recalculateUsage(prisma: PrismaClient, hotelId: string, periodStart?: Date) {
  const { start, end } = periodStart
    ? { start: periodStart, end: new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0) }
    : getMonthBounds(new Date());

  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { includedMinutes: true, monthlyPrice: true, pricePerMinute: true },
  });

  if (!hotel) return null;

  // Aggregate calls for the period
  const calls = await prisma.call.findMany({
    where: {
      hotelId,
      startedAt: { gte: start, lte: new Date(end.getTime() + 86400000) },
    },
    select: { status: true, duration: true },
  });

  const totalCalls = calls.length;
  const completedCalls = calls.filter(c => c.status === 'COMPLETED').length;
  const totalSeconds = calls.reduce((sum, c) => sum + (c.duration ?? 0), 0);
  const totalMinutes = Math.ceil(totalSeconds / 60);

  // Aggregate reservations
  const totalReservations = await prisma.reservation.count({
    where: {
      hotelId,
      createdAt: { gte: start, lte: new Date(end.getTime() + 86400000) },
    },
  });

  // Revenue from reservations
  const reservations = await prisma.reservation.findMany({
    where: {
      hotelId,
      createdAt: { gte: start, lte: new Date(end.getTime() + 86400000) },
      status: { in: ['CONFIRMED', 'MODIFIED', 'CHECKED_IN', 'CHECKED_OUT'] },
    },
    select: { totalPrice: true },
  });
  const revenue = reservations.reduce((sum, r) => sum + (r.totalPrice ? Number(r.totalPrice) : 0), 0);

  // Calculate overage
  const includedMinutes = hotel.includedMinutes;
  const overageMinutes = Math.max(0, totalMinutes - includedMinutes);
  const overageCost = overageMinutes * Number(hotel.pricePerMinute);
  const totalCost = Number(hotel.monthlyPrice) + overageCost;

  const record = await prisma.usageRecord.upsert({
    where: { hotelId_periodStart: { hotelId, periodStart: start } },
    update: {
      totalCalls,
      completedCalls,
      totalMinutes,
      totalReservations,
      revenue: Math.round(revenue * 100) / 100,
      includedMinutes,
      overageMinutes,
      overageCost: Math.round(overageCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
    },
    create: {
      hotelId,
      periodStart: start,
      periodEnd: end,
      totalCalls,
      completedCalls,
      totalMinutes,
      totalReservations,
      revenue: Math.round(revenue * 100) / 100,
      includedMinutes,
      overageMinutes,
      overageCost: Math.round(overageCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
    },
  });

  logger.info({ hotelId, totalCalls, totalMinutes, overageMinutes, totalCost }, 'Usage recalculated');
  return record;
}

/**
 * Get usage history for a hotel (last N months).
 */
export async function getUsageHistory(prisma: PrismaClient, hotelId: string, months = 6) {
  return prisma.usageRecord.findMany({
    where: { hotelId },
    orderBy: { periodStart: 'desc' },
    take: months,
  });
}

/**
 * Get billing summary for all active hotels (admin overview).
 */
export async function getAllHotelsBilling(prisma: PrismaClient) {
  const { start } = getMonthBounds(new Date());

  const hotels = await prisma.hotel.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      billingPlan: true,
      monthlyPrice: true,
      includedMinutes: true,
      pricePerMinute: true,
      usageRecords: {
        where: { periodStart: start },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  return hotels.map((hotel) => {
    const usage = hotel.usageRecords[0];
    return {
      hotelId: hotel.id,
      hotelName: hotel.name,
      plan: hotel.billingPlan,
      monthlyPrice: Number(hotel.monthlyPrice),
      includedMinutes: hotel.includedMinutes,
      pricePerMinute: Number(hotel.pricePerMinute),
      currentUsage: usage ? {
        totalCalls: usage.totalCalls,
        completedCalls: usage.completedCalls,
        totalMinutes: usage.totalMinutes,
        totalReservations: usage.totalReservations,
        revenue: Number(usage.revenue),
        overageMinutes: usage.overageMinutes,
        overageCost: Number(usage.overageCost),
        totalCost: Number(usage.totalCost),
        status: usage.status,
      } : null,
    };
  });
}

/**
 * Update a hotel's billing plan.
 */
export async function updateBillingPlan(
  prisma: PrismaClient,
  hotelId: string,
  plan: string,
) {
  const planConfig = BILLING_PLANS[plan];
  if (!planConfig) throw new Error(`Unknown plan: ${plan}`);

  return prisma.hotel.update({
    where: { id: hotelId },
    data: {
      billingPlan: plan,
      monthlyPrice: planConfig.monthlyPrice,
      includedMinutes: planConfig.includedMinutes,
      pricePerMinute: planConfig.pricePerMinute,
    },
  });
}
