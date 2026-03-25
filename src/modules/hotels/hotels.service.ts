import type { PrismaClient, Hotel, Prisma } from '@prisma/client';
import { createChildLogger } from '../../lib/logger.js';
import { getRedis } from '../../lib/redis.js';

const logger = createChildLogger({ module: 'hotels' });

const CACHE_PREFIX = 'hotel:phone:';
const CACHE_TTL = 300; // 5 minutes

export interface HotelConfig {
  id: string;
  name: string;
  timezone: string;
  phoneNumber: string;
  handoffPhone: string | null;
  greeting: string | null;
  checkInTime: string;
  checkOutTime: string;
  policies: Record<string, unknown> | null;
  pmsProvider: string;
  pmsConfig: Record<string, unknown> | null;
}

/**
 * Find hotel by incoming phone number (the Twilio number called).
 * Uses Redis cache to avoid DB lookup on every call.
 */
export async function findHotelByPhone(
  prisma: PrismaClient,
  phoneNumber: string,
): Promise<Hotel | null> {
  // Normalize phone number (strip formatting)
  const normalized = phoneNumber.replace(/[^+\d]/g, '');

  // Check Redis cache
  try {
    const redis = getRedis();
    const cached = await redis.get(`${CACHE_PREFIX}${normalized}`);
    if (cached) {
      return JSON.parse(cached) as Hotel;
    }
  } catch {
    // Cache miss or Redis error — fall through to DB
  }

  const hotel = await prisma.hotel.findUnique({
    where: { phoneNumber: normalized },
  });

  if (!hotel) {
    // Try without + prefix
    const withoutPlus = normalized.startsWith('+') ? normalized.slice(1) : `+${normalized}`;
    const altHotel = await prisma.hotel.findUnique({
      where: { phoneNumber: withoutPlus },
    });

    if (altHotel) {
      cacheHotel(normalized, altHotel);
      return altHotel;
    }

    logger.warn({ phoneNumber: normalized }, 'No hotel found for phone number');
    return null;
  }

  cacheHotel(normalized, hotel);
  return hotel;
}

function cacheHotel(phoneNumber: string, hotel: Hotel): void {
  try {
    const redis = getRedis();
    redis.set(`${CACHE_PREFIX}${phoneNumber}`, JSON.stringify(hotel), 'EX', CACHE_TTL);
  } catch {
    // Non-blocking
  }
}

/**
 * Invalidate hotel cache (call after updates).
 */
export async function invalidateHotelCache(phoneNumber: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(`${CACHE_PREFIX}${phoneNumber}`);
  } catch {
    // Non-blocking
  }
}

/**
 * Get full hotel config for AI session setup.
 */
export async function getHotelConfig(
  prisma: PrismaClient,
  hotelId: string,
): Promise<HotelConfig | null> {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) return null;

  return {
    id: hotel.id,
    name: hotel.name,
    timezone: hotel.timezone,
    phoneNumber: hotel.phoneNumber,
    handoffPhone: hotel.handoffPhone,
    greeting: hotel.greeting,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    policies: hotel.policies as Record<string, unknown> | null,
    pmsProvider: hotel.pmsProvider,
    pmsConfig: hotel.pmsConfig as Record<string, unknown> | null,
  };
}

export async function createHotel(
  prisma: PrismaClient,
  data: {
    name: string;
    phoneNumber: string;
    timezone?: string;
    handoffPhone?: string;
    greeting?: string;
    checkInTime?: string;
    checkOutTime?: string;
    policies?: Prisma.InputJsonValue;
    pmsProvider?: string;
    pmsConfig?: Prisma.InputJsonValue;
  },
): Promise<Hotel> {
  const hotel = await prisma.hotel.create({ data });
  logger.info({ hotelId: hotel.id, name: hotel.name }, 'Hotel created');
  return hotel;
}

export async function updateHotel(
  prisma: PrismaClient,
  id: string,
  data: Partial<{
    name: string;
    phoneNumber: string;
    timezone: string;
    handoffPhone: string;
    greeting: string;
    checkInTime: string;
    checkOutTime: string;
    policies: Prisma.InputJsonValue;
    pmsProvider: string;
    pmsConfig: Prisma.InputJsonValue;
    active: boolean;
  }>,
): Promise<Hotel> {
  const hotel = await prisma.hotel.update({ where: { id }, data: data as Prisma.HotelUpdateInput });

  // Invalidate cache if phone changed
  if (data.phoneNumber) {
    await invalidateHotelCache(hotel.phoneNumber);
  }

  logger.info({ hotelId: hotel.id }, 'Hotel updated');
  return hotel;
}

export async function listHotels(prisma: PrismaClient): Promise<Hotel[]> {
  return prisma.hotel.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
}

export async function getHotelById(prisma: PrismaClient, id: string): Promise<Hotel | null> {
  return prisma.hotel.findUnique({ where: { id } });
}
