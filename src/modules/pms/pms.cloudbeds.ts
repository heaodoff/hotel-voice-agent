import type { PmsProvider } from './pms.interface.js';
import type {
  CheckAvailabilityInput, AvailabilityResult,
  GetRatesInput, RateInfo,
  CreateReservationInput, ReservationResult,
  ModifyReservationInput,
  CancelReservationInput,
  FindReservationInput,
} from '../../lib/types.js';
import {
  type CloudbedsConfig,
  type CbReservation,
  cbGetAvailableRoomTypes,
  cbGetRatePlans,
  cbPostReservation,
  cbGetReservation,
  cbGetReservations,
  cbPutReservation,
} from './cloudbeds.client.js';
import { NotFoundError, PmsError } from '../../lib/errors.js';
import { createChildLogger } from '../../lib/logger.js';

const logger = createChildLogger({ module: 'cloudbeds-pms' });

// Default room type mapping: Cloudbeds name → our standard types
const DEFAULT_ROOM_MAPPING: Record<string, string> = {
  'standard': 'standard',
  'standard room': 'standard',
  'deluxe': 'deluxe',
  'deluxe room': 'deluxe',
  'suite': 'suite',
  'junior suite': 'suite',
  'family': 'family',
  'family room': 'family',
  'penthouse': 'penthouse',
  'penthouse suite': 'penthouse',
};

export class CloudbedsPmsProvider implements PmsProvider {
  readonly name = 'cloudbeds';
  private config: CloudbedsConfig;
  private roomMapping: Record<string, string>;
  private reverseMapping: Record<string, { roomTypeID: string; roomRateID: string; cbName: string }>;

  constructor(config: CloudbedsConfig) {
    this.config = config;
    this.roomMapping = { ...DEFAULT_ROOM_MAPPING, ...config.roomTypeMapping };
    this.reverseMapping = {};
  }

  private mapRoomType(cbName: string): string {
    const lower = cbName.toLowerCase();
    return this.roomMapping[lower] ?? lower;
  }

  private mapStatus(cbStatus: string): string {
    const statusMap: Record<string, string> = {
      confirmed: 'CONFIRMED',
      not_confirmed: 'PENDING',
      canceled: 'CANCELLED',
      checked_in: 'CHECKED_IN',
      checked_out: 'CHECKED_OUT',
      no_show: 'NO_SHOW',
    };
    return statusMap[cbStatus.toLowerCase()] ?? cbStatus.toUpperCase();
  }

  private mapReservation(cb: CbReservation, hotelName: string): ReservationResult {
    return {
      reservationId: cb.reservationID,
      confirmationCode: cb.thirdPartyIdentifier ?? `CB-${cb.reservationID}`,
      status: this.mapStatus(cb.status),
      hotelName,
      guestName: `${cb.guestFirstName} ${cb.guestLastName}`,
      checkInDate: cb.startDate,
      checkOutDate: cb.endDate,
      roomType: this.mapRoomType(cb.roomTypeName ?? cb.rooms?.[0]?.roomTypeName ?? 'standard'),
      roomCount: cb.rooms?.length ?? 1,
      guestCount: 1, // Cloudbeds doesn't return guest count directly
      totalPrice: cb.total,
      currency: cb.currency ?? 'USD',
    };
  }

  async checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityResult> {
    const roomTypes = await cbGetAvailableRoomTypes(this.config, input.checkInDate, input.checkOutDate);

    const checkIn = new Date(input.checkInDate);
    const checkOut = new Date(input.checkOutDate);
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);

    const rooms = roomTypes
      .map((rt) => {
        const mappedType = this.mapRoomType(rt.roomTypeName);
        // Cache room type IDs for later use in reservation creation
        this.reverseMapping[mappedType] = {
          roomTypeID: rt.roomTypeID,
          roomRateID: rt.roomRateID,
          cbName: rt.roomTypeName,
        };

        return {
          roomType: mappedType as 'standard' | 'deluxe' | 'suite' | 'family' | 'penthouse',
          available: rt.roomsAvailable > 0,
          roomsLeft: rt.roomsAvailable,
          ratePerNight: rt.roomRate,
          currency: 'USD',
        };
      })
      .filter((r) => !input.roomType || r.roomType === input.roomType);

    return {
      hotelId: input.hotelId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      nights,
      rooms,
    };
  }

  async getRates(input: GetRatesInput): Promise<RateInfo[]> {
    const ratePlans = await cbGetRatePlans(this.config, input.checkInDate, input.checkOutDate);

    const checkIn = new Date(input.checkInDate);
    const checkOut = new Date(input.checkOutDate);
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);

    const rates: RateInfo[] = [];

    for (const plan of ratePlans) {
      const mappedType = this.mapRoomType(plan.roomTypeName);
      if (input.roomType && mappedType !== input.roomType) continue;

      // Calculate average rate from detailed daily rates
      const dailyRates = Object.values(plan.dates ?? {});
      const avgRate = dailyRates.length > 0
        ? dailyRates.reduce((sum, d) => sum + d.rate, 0) / dailyRates.length
        : 0;

      rates.push({
        roomType: mappedType as 'standard' | 'deluxe' | 'suite' | 'family' | 'penthouse',
        ratePerNight: Math.round(avgRate * 100) / 100,
        totalPrice: Math.round(avgRate * nights * 100) / 100,
        currency: 'USD',
        nights,
      });
    }

    return rates;
  }

  async createReservation(input: CreateReservationInput): Promise<ReservationResult> {
    // Lookup Cloudbeds room type ID
    const mapping = this.reverseMapping[input.roomType];
    if (!mapping) {
      // Try to get availability first to populate mapping
      await this.checkAvailability({
        hotelId: input.hotelId,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        guestCount: input.guestCount ?? 1,
      });
    }

    const rm = this.reverseMapping[input.roomType];
    if (!rm) {
      throw new PmsError(`Room type "${input.roomType}" not found in Cloudbeds property`);
    }

    const reservation = await cbPostReservation(this.config, {
      startDate: input.checkInDate,
      endDate: input.checkOutDate,
      guestFirstName: input.guestFirstName,
      guestLastName: input.guestLastName,
      guestPhone: input.guestPhone,
      guestEmail: input.guestEmail,
      roomTypeID: rm.roomTypeID,
      roomRateID: rm.roomRateID,
      adults: String(input.guestCount ?? 1),
    });

    logger.info({ reservationId: reservation.reservationID, propertyId: this.config.propertyId }, 'Reservation created in Cloudbeds');

    return this.mapReservation(reservation, `Property ${this.config.propertyId}`);
  }

  async modifyReservation(input: ModifyReservationInput): Promise<ReservationResult> {
    const resId = input.reservationId ?? input.confirmationCode?.replace('CB-', '');
    if (!resId) {
      // Lookup by phone
      if (input.guestPhone) {
        const results = await cbGetReservations(this.config, { phone: input.guestPhone });
        const active = results.find(r => r.status !== 'canceled');
        if (!active) throw new NotFoundError('Reservation');
        return this.modifyById(active.reservationID, input);
      }
      throw new NotFoundError('Reservation');
    }
    return this.modifyById(resId, input);
  }

  private async modifyById(reservationId: string, input: ModifyReservationInput): Promise<ReservationResult> {
    const updates: Record<string, string> = {};
    if (input.checkInDate) updates['startDate'] = input.checkInDate;
    if (input.checkOutDate) updates['endDate'] = input.checkOutDate;

    const updated = await cbPutReservation(this.config, reservationId, updates);
    return this.mapReservation(updated, `Property ${this.config.propertyId}`);
  }

  async cancelReservation(input: CancelReservationInput): Promise<{ success: boolean; message: string }> {
    const resId = input.reservationId ?? input.confirmationCode?.replace('CB-', '');
    if (!resId) {
      if (input.guestPhone) {
        const results = await cbGetReservations(this.config, { phone: input.guestPhone });
        const active = results.find(r => r.status !== 'canceled');
        if (!active) throw new NotFoundError('Reservation');
        await cbPutReservation(this.config, active.reservationID, { status: 'canceled' });
        return { success: true, message: `Reservation ${active.reservationID} cancelled in Cloudbeds` };
      }
      throw new NotFoundError('Reservation');
    }

    await cbPutReservation(this.config, resId, { status: 'canceled' });
    return { success: true, message: `Reservation ${resId} cancelled in Cloudbeds` };
  }

  async findReservation(input: FindReservationInput): Promise<ReservationResult | null> {
    // Direct lookup by ID
    if (input.reservationId || input.confirmationCode) {
      const resId = input.reservationId ?? input.confirmationCode?.replace('CB-', '');
      if (resId) {
        const res = await cbGetReservation(this.config, resId);
        if (res) return this.mapReservation(res, `Property ${this.config.propertyId}`);
      }
    }

    // Search by phone or name
    const filters: { phone?: string; guestName?: string } = {};
    if (input.guestPhone) filters.phone = input.guestPhone;
    if (input.guestLastName) filters.guestName = input.guestLastName;

    if (Object.keys(filters).length > 0) {
      const results = await cbGetReservations(this.config, filters);
      const active = results.find(r => r.status !== 'canceled');
      if (active) return this.mapReservation(active, `Property ${this.config.propertyId}`);
    }

    return null;
  }
}
