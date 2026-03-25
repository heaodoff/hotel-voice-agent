import type { PrismaClient, HandoffReason } from '@prisma/client';
import { getEnv } from '../../config/index.js';
import { createChildLogger } from '../../lib/logger.js';
import type { TransferToHumanInput } from '../../lib/types.js';
import { getConversationSummary } from '../ai/index.js';
import { sendConfirmationSms } from '../notifications/sms.adapter.js';

const logger = createChildLogger({ module: 'handoff' });

export interface HandoffResult {
  success: boolean;
  transferTo: string;
  message: string;
}

/**
 * Initiate a transfer to a human agent.
 * Records the handoff event, sends context SMS to the agent, and returns the target number.
 */
export async function initiateHandoff(
  prisma: PrismaClient,
  callId: string,
  input: TransferToHumanInput,
  callSid?: string,
): Promise<HandoffResult> {
  const env = getEnv();

  // Try to get per-hotel handoff number
  let transferTo = env.HANDOFF_PHONE_NUMBER;
  if (callSid) {
    try {
      const call = await prisma.call.findUnique({
        where: { twilioCallSid: callSid },
        include: { hotel: { select: { handoffPhone: true, name: true } } },
      });
      if (call?.hotel?.handoffPhone) {
        transferTo = call.hotel.handoffPhone;
      }
    } catch {
      // Fallback to env number
    }
  }

  const reasonMap: Record<string, HandoffReason> = {
    caller_request: 'CALLER_REQUEST',
    caller_frustrated: 'CALLER_FRUSTRATED',
    group_booking: 'GROUP_BOOKING',
    payment_issue: 'PAYMENT_ISSUE',
    tool_failure: 'TOOL_FAILURE',
    vip_request: 'VIP_REQUEST',
    unsupported_request: 'UNSUPPORTED_REQUEST',
    agent_uncertainty: 'AGENT_UNCERTAINTY',
  };

  const reason = reasonMap[input.reason] ?? 'CALLER_REQUEST';

  // Collect conversation summary for context
  let conversationSummary: string | undefined;
  if (callSid) {
    conversationSummary = getConversationSummary(callSid);
  }

  await prisma.handoffEvent.create({
    data: {
      callId,
      reason,
      description: input.description ?? input.callerSummary,
      conversationSummary,
      transferTo,
      success: true,
    },
  });

  // Send context SMS to the human agent
  if (callSid) {
    try {
      const call = await prisma.call.findUnique({
        where: { twilioCallSid: callSid },
        include: { guest: true },
      });

      const guestName = call?.guest?.firstName
        ? `${call.guest.firstName} ${call.guest.lastName ?? ''}`.trim()
        : call?.callerNumber ?? 'Unknown';

      const smsBody = [
        `📞 Transfer incoming`,
        `Guest: ${guestName}`,
        `Reason: ${input.reason}`,
        ...(input.description ? [`Note: ${input.description}`] : []),
        ...(conversationSummary ? [`\nConversation:\n${conversationSummary.slice(0, 500)}`] : []),
      ].join('\n');

      // Reuse SMS adapter with a custom shape
      await sendConfirmationSms({
        to: transferTo,
        confirmationCode: 'HANDOFF',
        guestName,
        hotelName: env.DEFAULT_HOTEL_NAME,
        checkInDate: '-',
        checkOutDate: '-',
        roomType: smsBody, // Abuse roomType field for full body — TODO: add generic SMS method
      });
      logger.info({ callSid, transferTo }, 'Handoff context SMS sent');
    } catch (err) {
      logger.warn({ err, callSid }, 'Failed to send handoff SMS (non-blocking)');
    }
  }

  logger.info({ callId, reason: input.reason, transferTo }, 'Handoff initiated');

  return {
    success: true,
    transferTo,
    message: `Transferring call to human agent at ${transferTo}. Reason: ${input.reason}`,
  };
}
