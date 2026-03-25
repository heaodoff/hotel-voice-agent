import { createChildLogger } from '../../lib/logger.js';
import type { SendEmailInput } from '../../lib/types.js';

const logger = createChildLogger({ module: 'email-adapter' });

/**
 * Email adapter stub.
 * TODO: Integrate with Postmark, SendGrid, or SES for production.
 */
export async function sendConfirmationEmail(input: SendEmailInput): Promise<{ success: boolean; messageId?: string }> {
  const subject = `Reservation Confirmed - ${input.confirmationCode}`;

  const textBody = [
    `Dear ${input.guestName},`,
    '',
    `Your reservation at ${input.hotelName} has been confirmed.`,
    '',
    `Confirmation Code: ${input.confirmationCode}`,
    `Check-in: ${input.checkInDate}`,
    `Check-out: ${input.checkOutDate}`,
    `Room Type: ${input.roomType}`,
    input.totalPrice ? `Total: ${input.currency} ${input.totalPrice.toFixed(2)}` : '',
    '',
    'Thank you for choosing us!',
  ]
    .filter(Boolean)
    .join('\n');

  // Stub: log the email instead of sending
  logger.info(
    { to: input.to, subject, bodyLength: textBody.length },
    'Email confirmation (stub - not sent)',
  );

  // TODO: Replace with actual email sending
  // Example with Postmark:
  // const client = new postmark.ServerClient(env.POSTMARK_API_TOKEN);
  // const result = await client.sendEmail({
  //   From: env.EMAIL_FROM,
  //   To: input.to,
  //   Subject: subject,
  //   TextBody: textBody,
  // });

  return { success: true, messageId: 'stub_' + Date.now() };
}
