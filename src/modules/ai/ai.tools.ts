import type { PrismaClient } from '@prisma/client';
import {
  checkAvailabilityInputSchema,
  getRatesInputSchema,
  createReservationInputSchema,
  modifyReservationInputSchema,
  cancelReservationInputSchema,
  findReservationInputSchema,
  sendSmsInputSchema,
  sendEmailInputSchema,
  transferToHumanInputSchema,
} from '../../lib/types.js';
import {
  checkAvailability,
  getRoomRates,
  createReservation,
  modifyReservation,
  cancelReservation,
  findReservation,
} from '../reservations/index.js';
import { sendReservationConfirmationSms, sendReservationConfirmationEmail } from '../notifications/index.js';
import { initiateHandoff } from '../handoff/index.js';
import { logToolCall } from '../calls/index.js';
import { createChildLogger } from '../../lib/logger.js';

const logger = createChildLogger({ module: 'ai-tools' });

/**
 * OpenAI Realtime tool definitions.
 * These are registered with the OpenAI Realtime session and called
 * when the model decides to invoke a function.
 */
export const toolDefinitions = [
  {
    type: 'function' as const,
    name: 'check_availability',
    description: 'Check room availability for given dates at the hotel. Returns available room types, rates, and remaining inventory.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string', description: 'Hotel identifier' },
        checkInDate: { type: 'string', description: 'Check-in date in YYYY-MM-DD format' },
        checkOutDate: { type: 'string', description: 'Check-out date in YYYY-MM-DD format' },
        roomType: { type: 'string', enum: ['standard', 'deluxe', 'suite', 'family', 'penthouse'], description: 'Optional specific room type to check' },
        guestCount: { type: 'number', description: 'Number of guests (default 1)' },
      },
      required: ['hotelId', 'checkInDate', 'checkOutDate'],
    },
  },
  {
    type: 'function' as const,
    name: 'get_room_rates',
    description: 'Get room rates for given dates. Returns price per night and total for each room type.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string' },
        checkInDate: { type: 'string', description: 'YYYY-MM-DD' },
        checkOutDate: { type: 'string', description: 'YYYY-MM-DD' },
        roomType: { type: 'string', enum: ['standard', 'deluxe', 'suite', 'family', 'penthouse'] },
      },
      required: ['hotelId', 'checkInDate', 'checkOutDate'],
    },
  },
  {
    type: 'function' as const,
    name: 'create_reservation',
    description: 'Create a new reservation. Requires guest name, contact, dates, and room type. Returns confirmation code.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string' },
        guestFirstName: { type: 'string' },
        guestLastName: { type: 'string' },
        guestPhone: { type: 'string' },
        guestEmail: { type: 'string' },
        checkInDate: { type: 'string', description: 'YYYY-MM-DD' },
        checkOutDate: { type: 'string', description: 'YYYY-MM-DD' },
        roomType: { type: 'string', enum: ['standard', 'deluxe', 'suite', 'family', 'penthouse'] },
        roomCount: { type: 'number', description: 'Number of rooms (default 1)' },
        guestCount: { type: 'number', description: 'Number of guests (default 1)' },
        specialRequests: { type: 'string' },
      },
      required: ['hotelId', 'guestFirstName', 'guestLastName', 'guestPhone', 'checkInDate', 'checkOutDate', 'roomType'],
    },
  },
  {
    type: 'function' as const,
    name: 'modify_reservation',
    description: 'Modify an existing reservation. Provide confirmation code or guest phone to identify the reservation.',
    parameters: {
      type: 'object',
      properties: {
        reservationId: { type: 'string' },
        confirmationCode: { type: 'string' },
        guestPhone: { type: 'string' },
        checkInDate: { type: 'string', description: 'YYYY-MM-DD' },
        checkOutDate: { type: 'string', description: 'YYYY-MM-DD' },
        roomType: { type: 'string', enum: ['standard', 'deluxe', 'suite', 'family', 'penthouse'] },
        guestCount: { type: 'number' },
        specialRequests: { type: 'string' },
      },
      required: [],
    },
  },
  {
    type: 'function' as const,
    name: 'cancel_reservation',
    description: 'Cancel an existing reservation. Provide confirmation code or guest phone to identify the reservation.',
    parameters: {
      type: 'object',
      properties: {
        reservationId: { type: 'string' },
        confirmationCode: { type: 'string' },
        guestPhone: { type: 'string' },
        reason: { type: 'string' },
      },
      required: [],
    },
  },
  {
    type: 'function' as const,
    name: 'find_reservation',
    description: 'Look up an existing reservation by confirmation code, phone number, or guest last name.',
    parameters: {
      type: 'object',
      properties: {
        reservationId: { type: 'string' },
        confirmationCode: { type: 'string' },
        guestPhone: { type: 'string' },
        guestLastName: { type: 'string' },
      },
      required: [],
    },
  },
  {
    type: 'function' as const,
    name: 'send_confirmation_sms',
    description: 'Send a reservation confirmation via SMS to the guest phone number.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Phone number to send SMS to' },
        confirmationCode: { type: 'string' },
        guestName: { type: 'string' },
        hotelName: { type: 'string' },
        checkInDate: { type: 'string' },
        checkOutDate: { type: 'string' },
        roomType: { type: 'string' },
      },
      required: ['to', 'confirmationCode', 'guestName', 'hotelName', 'checkInDate', 'checkOutDate', 'roomType'],
    },
  },
  {
    type: 'function' as const,
    name: 'send_confirmation_email',
    description: 'Send a reservation confirmation via email.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Email address' },
        confirmationCode: { type: 'string' },
        guestName: { type: 'string' },
        hotelName: { type: 'string' },
        checkInDate: { type: 'string' },
        checkOutDate: { type: 'string' },
        roomType: { type: 'string' },
        totalPrice: { type: 'number' },
        currency: { type: 'string' },
      },
      required: ['to', 'confirmationCode', 'guestName', 'hotelName', 'checkInDate', 'checkOutDate', 'roomType'],
    },
  },
  {
    type: 'function' as const,
    name: 'transfer_to_human',
    description: 'Transfer the call to a human agent. Use when the caller requests it, is frustrated, or when the request is too complex.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['caller_request', 'caller_frustrated', 'group_booking', 'payment_issue', 'tool_failure', 'vip_request', 'unsupported_request', 'agent_uncertainty'],
        },
        description: { type: 'string', description: 'Brief description of the situation' },
        callerSummary: { type: 'string', description: 'Summary of the conversation so far' },
      },
      required: ['reason'],
    },
  },
];

type ToolHandler = (args: unknown) => Promise<unknown>;

/**
 * Create tool handler functions bound to a specific call session.
 */
export function createToolHandlers(
  prisma: PrismaClient,
  callSid: string,
  callId: string,
  hotelId: string,
): Record<string, ToolHandler> {
  async function executeWithLogging(
    toolName: string,
    args: unknown,
    handler: () => Promise<unknown>,
  ): Promise<unknown> {
    const startTime = Date.now();
    try {
      const result = await handler();
      const durationMs = Date.now() - startTime;
      await logToolCall(prisma, callSid, toolName, args, result, null, durationMs);
      logger.info({ toolName, durationMs, callSid }, 'Tool executed successfully');
      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      await logToolCall(prisma, callSid, toolName, args, null, errorMsg, durationMs);
      logger.error({ err, toolName, callSid }, 'Tool execution failed');
      return { error: true, message: errorMsg };
    }
  }

  return {
    check_availability: (args) =>
      executeWithLogging('check_availability', args, () => {
        const input = checkAvailabilityInputSchema.parse({ ...args as object, hotelId });
        return checkAvailability(input, prisma);
      }),

    get_room_rates: (args) =>
      executeWithLogging('get_room_rates', args, () => {
        const input = getRatesInputSchema.parse({ ...args as object, hotelId });
        return getRoomRates(input, prisma);
      }),

    create_reservation: (args) =>
      executeWithLogging('create_reservation', args, () => {
        const input = createReservationInputSchema.parse({ ...args as object, hotelId });
        return createReservation(prisma, input);
      }),

    modify_reservation: (args) =>
      executeWithLogging('modify_reservation', args, () => {
        const input = modifyReservationInputSchema.parse(args);
        return modifyReservation(prisma, input);
      }),

    cancel_reservation: (args) =>
      executeWithLogging('cancel_reservation', args, () => {
        const input = cancelReservationInputSchema.parse(args);
        return cancelReservation(prisma, input);
      }),

    find_reservation: (args) =>
      executeWithLogging('find_reservation', args, () => {
        const input = findReservationInputSchema.parse(args);
        return findReservation(input, prisma, hotelId);
      }),

    send_confirmation_sms: (args) =>
      executeWithLogging('send_confirmation_sms', args, () => {
        const input = sendSmsInputSchema.parse(args);
        return sendReservationConfirmationSms(input);
      }),

    send_confirmation_email: (args) =>
      executeWithLogging('send_confirmation_email', args, () => {
        const input = sendEmailInputSchema.parse(args);
        return sendReservationConfirmationEmail(input);
      }),

    transfer_to_human: (args) =>
      executeWithLogging('transfer_to_human', args, () => {
        const input = transferToHumanInputSchema.parse(args);
        return initiateHandoff(prisma, callId, input, callSid);
      }),
  };
}
