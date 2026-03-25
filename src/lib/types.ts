import { z } from 'zod';

// Common date schemas
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// Room types available in the system
export const ROOM_TYPES = ['standard', 'deluxe', 'suite', 'family', 'penthouse'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const roomTypeSchema = z.enum(ROOM_TYPES);

// Availability check
export const checkAvailabilityInputSchema = z.object({
  hotelId: z.string(),
  checkInDate: dateStringSchema,
  checkOutDate: dateStringSchema,
  roomType: roomTypeSchema.optional(),
  guestCount: z.number().int().min(1).max(20).default(1),
});
export type CheckAvailabilityInput = z.infer<typeof checkAvailabilityInputSchema>;

export interface RoomAvailability {
  roomType: RoomType;
  available: boolean;
  roomsLeft: number;
  ratePerNight: number;
  currency: string;
}

export interface AvailabilityResult {
  hotelId: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  rooms: RoomAvailability[];
}

// Room rates
export const getRatesInputSchema = z.object({
  hotelId: z.string(),
  checkInDate: dateStringSchema,
  checkOutDate: dateStringSchema,
  roomType: roomTypeSchema.optional(),
});
export type GetRatesInput = z.infer<typeof getRatesInputSchema>;

export interface RateInfo {
  roomType: RoomType;
  ratePerNight: number;
  totalPrice: number;
  currency: string;
  nights: number;
}

// Create reservation
export const createReservationInputSchema = z.object({
  hotelId: z.string(),
  guestFirstName: z.string().min(1),
  guestLastName: z.string().min(1),
  guestPhone: z.string().min(1),
  guestEmail: z.string().email().optional(),
  checkInDate: dateStringSchema,
  checkOutDate: dateStringSchema,
  roomType: roomTypeSchema,
  roomCount: z.number().int().min(1).max(10).default(1),
  guestCount: z.number().int().min(1).max(20).default(1),
  specialRequests: z.string().optional(),
});
export type CreateReservationInput = z.infer<typeof createReservationInputSchema>;

export interface ReservationResult {
  reservationId: string;
  confirmationCode: string;
  status: string;
  hotelName: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  roomCount: number;
  guestCount: number;
  totalPrice: number;
  currency: string;
  specialRequests?: string;
}

// Modify reservation
export const modifyReservationInputSchema = z.object({
  reservationId: z.string().optional(),
  confirmationCode: z.string().optional(),
  guestPhone: z.string().optional(),
  checkInDate: dateStringSchema.optional(),
  checkOutDate: dateStringSchema.optional(),
  roomType: roomTypeSchema.optional(),
  guestCount: z.number().int().min(1).max(20).optional(),
  specialRequests: z.string().optional(),
}).refine(
  (data) => data.reservationId || data.confirmationCode || data.guestPhone,
  'Must provide reservationId, confirmationCode, or guestPhone to identify the reservation',
);
export type ModifyReservationInput = z.infer<typeof modifyReservationInputSchema>;

// Cancel reservation
export const cancelReservationInputSchema = z.object({
  reservationId: z.string().optional(),
  confirmationCode: z.string().optional(),
  guestPhone: z.string().optional(),
  reason: z.string().optional(),
}).refine(
  (data) => data.reservationId || data.confirmationCode || data.guestPhone,
  'Must provide reservationId, confirmationCode, or guestPhone',
);
export type CancelReservationInput = z.infer<typeof cancelReservationInputSchema>;

// Find reservation
export const findReservationInputSchema = z.object({
  reservationId: z.string().optional(),
  confirmationCode: z.string().optional(),
  guestPhone: z.string().optional(),
  guestLastName: z.string().optional(),
}).refine(
  (data) => data.reservationId || data.confirmationCode || data.guestPhone || data.guestLastName,
  'Must provide at least one search criterion',
);
export type FindReservationInput = z.infer<typeof findReservationInputSchema>;

// Notifications
export const sendSmsInputSchema = z.object({
  to: z.string().min(1),
  confirmationCode: z.string(),
  guestName: z.string(),
  hotelName: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  roomType: z.string(),
});
export type SendSmsInput = z.infer<typeof sendSmsInputSchema>;

export const sendEmailInputSchema = z.object({
  to: z.string().email(),
  confirmationCode: z.string(),
  guestName: z.string(),
  hotelName: z.string(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  roomType: z.string(),
  totalPrice: z.number().optional(),
  currency: z.string().default('USD'),
});
export type SendEmailInput = z.infer<typeof sendEmailInputSchema>;

// Transfer to human
export const transferToHumanInputSchema = z.object({
  reason: z.enum([
    'caller_request',
    'caller_frustrated',
    'group_booking',
    'payment_issue',
    'tool_failure',
    'vip_request',
    'unsupported_request',
    'agent_uncertainty',
  ]),
  description: z.string().optional(),
  callerSummary: z.string().optional(),
});
export type TransferToHumanInput = z.infer<typeof transferToHumanInputSchema>;
