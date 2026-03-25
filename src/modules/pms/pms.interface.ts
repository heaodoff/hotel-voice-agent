import type {
  CheckAvailabilityInput,
  AvailabilityResult,
  GetRatesInput,
  RateInfo,
  CreateReservationInput,
  ReservationResult,
  ModifyReservationInput,
  CancelReservationInput,
  FindReservationInput,
} from '../../lib/types.js';

/**
 * Abstract PMS provider interface.
 * Implement this for each PMS system (Mews, Cloudbeds, Opera, etc.)
 */
export interface PmsProvider {
  readonly name: string;

  checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityResult>;

  getRates(input: GetRatesInput): Promise<RateInfo[]>;

  createReservation(input: CreateReservationInput): Promise<ReservationResult>;

  modifyReservation(input: ModifyReservationInput): Promise<ReservationResult>;

  cancelReservation(input: CancelReservationInput): Promise<{ success: boolean; message: string }>;

  findReservation(input: FindReservationInput): Promise<ReservationResult | null>;
}
