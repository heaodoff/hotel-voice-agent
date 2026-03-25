import { sendConfirmationSms } from './sms.adapter.js';
import { sendConfirmationEmail } from './email.adapter.js';
import type { SendSmsInput, SendEmailInput } from '../../lib/types.js';
import { createChildLogger } from '../../lib/logger.js';

const logger = createChildLogger({ module: 'notifications' });

export async function sendReservationConfirmationSms(
  input: SendSmsInput,
): Promise<{ success: boolean; message: string }> {
  const result = await sendConfirmationSms(input);
  if (result.success) {
    logger.info({ to: input.to, confirmationCode: input.confirmationCode }, 'SMS confirmation sent');
    return { success: true, message: `SMS confirmation sent to ${input.to}` };
  }
  return { success: false, message: 'Failed to send SMS confirmation' };
}

export async function sendReservationConfirmationEmail(
  input: SendEmailInput,
): Promise<{ success: boolean; message: string }> {
  const result = await sendConfirmationEmail(input);
  if (result.success) {
    logger.info({ to: input.to, confirmationCode: input.confirmationCode }, 'Email confirmation sent');
    return { success: true, message: `Email confirmation sent to ${input.to}` };
  }
  return { success: false, message: 'Failed to send email confirmation' };
}
