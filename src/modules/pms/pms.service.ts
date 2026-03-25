import type { PrismaClient } from '@prisma/client';
import type { PmsProvider } from './pms.interface.js';
import { MockPmsProvider } from './pms.mock.js';
import { CloudbedsPmsProvider } from './pms.cloudbeds.js';
import type { CloudbedsConfig } from './cloudbeds.client.js';
import { createChildLogger } from '../../lib/logger.js';

const logger = createChildLogger({ module: 'pms-service' });

// Global fallback provider
let _defaultProvider: PmsProvider | null = null;

// Per-hotel provider cache (hotelId → provider instance)
const _hotelProviders = new Map<string, PmsProvider>();

/**
 * Get the default PMS provider (mock). Used as fallback.
 */
export function getPmsProvider(): PmsProvider {
  if (!_defaultProvider) {
    _defaultProvider = new MockPmsProvider();
    logger.info({ provider: _defaultProvider.name }, 'Default PMS provider initialized');
  }
  return _defaultProvider;
}

export function setPmsProvider(provider: PmsProvider): void {
  _defaultProvider = provider;
  logger.info({ provider: provider.name }, 'Default PMS provider set');
}

/**
 * Get PMS provider for a specific hotel.
 * Reads hotel.pmsProvider and hotel.pmsConfig from DB, caches the instance.
 */
export async function getPmsProviderForHotel(
  prisma: PrismaClient,
  hotelId: string,
): Promise<PmsProvider> {
  // Check cache first
  const cached = _hotelProviders.get(hotelId);
  if (cached) return cached;

  // Load hotel config from DB
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { pmsProvider: true, pmsConfig: true, name: true },
  });

  if (!hotel) {
    logger.warn({ hotelId }, 'Hotel not found, using default PMS provider');
    return getPmsProvider();
  }

  let provider: PmsProvider;

  switch (hotel.pmsProvider) {
    case 'cloudbeds': {
      const config = hotel.pmsConfig as CloudbedsConfig | null;
      if (!config?.apiKey || !config?.propertyId) {
        logger.warn({ hotelId, provider: 'cloudbeds' }, 'Cloudbeds config incomplete, falling back to mock');
        provider = getPmsProvider();
        break;
      }
      provider = new CloudbedsPmsProvider(config);
      logger.info({ hotelId, provider: 'cloudbeds', propertyId: config.propertyId }, 'Cloudbeds PMS provider created');
      break;
    }

    case 'mock':
    default:
      provider = getPmsProvider();
      break;
  }

  _hotelProviders.set(hotelId, provider);
  return provider;
}

/**
 * Invalidate cached PMS provider for a hotel (call when hotel config changes).
 */
export function invalidatePmsProvider(hotelId: string): void {
  _hotelProviders.delete(hotelId);
  logger.info({ hotelId }, 'PMS provider cache invalidated');
}
