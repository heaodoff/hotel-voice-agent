import { createChildLogger } from '../../lib/logger.js';
import { PmsError } from '../../lib/errors.js';

const logger = createChildLogger({ module: 'cloudbeds-client' });

const BASE_URL = 'https://api.cloudbeds.com/api/v1.2';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export interface CloudbedsConfig {
  apiKey: string;
  propertyId: string;
  roomTypeMapping?: Record<string, string>; // Cloudbeds room name → our room type
}

interface CloudbedsResponse {
  success: boolean;
  data?: unknown;
  message?: string;
}

async function cbFetch(
  config: CloudbedsConfig,
  method: string,
  httpMethod: 'GET' | 'POST' | 'PUT' = 'GET',
  params?: Record<string, string>,
  retries = 0,
): Promise<unknown> {
  const url = new URL(`${BASE_URL}/${method}`);

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Accept': 'application/json',
  };

  let body: string | undefined;

  if (httpMethod === 'GET' && params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  } else if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(params).toString();
  }

  const startMs = Date.now();

  try {
    const res = await fetch(url.toString(), { method: httpMethod, headers, body });
    const durationMs = Date.now() - startMs;

    logger.info({ method, httpMethod, status: res.status, durationMs, propertyId: config.propertyId }, 'Cloudbeds API call');

    if (res.status === 429 && retries < MAX_RETRIES) {
      logger.warn({ method, retries }, 'Cloudbeds rate limit, retrying');
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (retries + 1)));
      return cbFetch(config, method, httpMethod, params, retries + 1);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new PmsError(`Cloudbeds API ${method} failed: ${res.status} ${text}`);
    }

    const json = await res.json() as CloudbedsResponse;

    if (!json.success) {
      throw new PmsError(`Cloudbeds ${method}: ${json.message ?? 'Unknown error'}`);
    }

    return json.data;
  } catch (err) {
    if (err instanceof PmsError) throw err;
    throw new PmsError(`Cloudbeds ${method}: ${err instanceof Error ? err.message : 'Network error'}`);
  }
}

// --- Typed API methods ---

export interface CbRoomType {
  roomTypeID: string;
  roomTypeName: string;
  roomTypeNameShort: string;
  maxGuests: number;
  adultsIncluded: number;
  roomsAvailable: number;
  roomRate: number;
  roomRateID: string;
}

export interface CbRatePlan {
  ratePlanID: string;
  ratePlanName: string;
  roomTypeID: string;
  roomTypeName: string;
  dates: Record<string, { rate: number; available: number; minStay: number }>;
}

export interface CbReservation {
  reservationID: string;
  status: string;
  guestFirstName: string;
  guestLastName: string;
  guestPhone: string;
  guestEmail: string;
  startDate: string;
  endDate: string;
  roomTypeName: string;
  rooms: { roomTypeName: string; roomTypeID: string }[];
  total: number;
  balance: number;
  currency: string;
  source: string;
  thirdPartyIdentifier?: string;
}

export async function cbGetAvailableRoomTypes(
  config: CloudbedsConfig,
  startDate: string,
  endDate: string,
): Promise<CbRoomType[]> {
  const data = await cbFetch(config, 'getAvailableRoomTypes', 'GET', {
    propertyID: config.propertyId,
    startDate,
    endDate,
  });
  return (data as CbRoomType[]) ?? [];
}

export async function cbGetRatePlans(
  config: CloudbedsConfig,
  startDate: string,
  endDate: string,
): Promise<CbRatePlan[]> {
  const data = await cbFetch(config, 'getRatePlans', 'GET', {
    propertyID: config.propertyId,
    startDate,
    endDate,
    detailedRates: 'true',
  });
  return (data as CbRatePlan[]) ?? [];
}

export async function cbPostReservation(
  config: CloudbedsConfig,
  params: {
    startDate: string;
    endDate: string;
    guestFirstName: string;
    guestLastName: string;
    guestPhone: string;
    guestEmail?: string;
    roomTypeID: string;
    roomRateID: string;
    adults: string;
    children?: string;
    sourceID?: string;
  },
): Promise<CbReservation> {
  const data = await cbFetch(config, 'postReservation', 'POST', {
    propertyID: config.propertyId,
    ...params,
  });
  return data as CbReservation;
}

export async function cbGetReservation(
  config: CloudbedsConfig,
  reservationId: string,
): Promise<CbReservation | null> {
  try {
    const data = await cbFetch(config, 'getReservation', 'GET', {
      propertyID: config.propertyId,
      reservationID: reservationId,
    });
    return data as CbReservation;
  } catch {
    return null;
  }
}

export async function cbGetReservations(
  config: CloudbedsConfig,
  filters?: { status?: string; guestName?: string; phone?: string },
): Promise<CbReservation[]> {
  const params: Record<string, string> = { propertyID: config.propertyId };
  if (filters?.status) params['status'] = filters.status;
  if (filters?.guestName) params['guestName'] = filters.guestName;
  if (filters?.phone) params['phone'] = filters.phone;

  const data = await cbFetch(config, 'getReservations', 'GET', params);
  return (data as { reservations?: CbReservation[] })?.reservations ?? [];
}

export async function cbPutReservation(
  config: CloudbedsConfig,
  reservationId: string,
  updates: Record<string, string>,
): Promise<CbReservation> {
  const data = await cbFetch(config, 'putReservation', 'PUT', {
    propertyID: config.propertyId,
    reservationID: reservationId,
    ...updates,
  });
  return data as CbReservation;
}
