import Twilio from 'twilio';
import { getEnv } from '../../config/index.js';
import { createChildLogger } from '../../lib/logger.js';
import type { SendSmsInput } from '../../lib/types.js';

const logger = createChildLogger({ module: 'sms-adapter' });

export async function sendConfirmationSms(input: SendSmsInput): Promise<{ success: boolean; sid?: string }> {
  const env = getEnv();

  const body = [
    `Confirmation: ${input.confirmationCode}`,
    `${input.hotelName}`,
    `Guest: ${input.guestName}`,
    `Check-in: ${input.checkInDate}`,
    `Check-out: ${input.checkOutDate}`,
    `Room: ${input.roomType}`,
    `Reply HELP for assistance.`,
  ].join('\n');

  if (env.NODE_ENV === 'development') {
    logger.info({ to: input.to, body }, 'SMS (dev mode - not sent)');
    return { success: true, sid: 'dev_stub_' + Date.now() };
  }

  try {
    const client = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({
      to: input.to,
      from: env.TWILIO_PHONE_NUMBER,
      body,
    });

    logger.info({ sid: message.sid, to: input.to }, 'SMS sent');
    return { success: true, sid: message.sid };
  } catch (err) {
    logger.error({ err, to: input.to }, 'Failed to send SMS');
    return { success: false };
  }
}
