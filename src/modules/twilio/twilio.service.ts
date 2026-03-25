import Twilio from 'twilio';
import { getEnv } from '../../config/index.js';
import { createChildLogger } from '../../lib/logger.js';

const logger = createChildLogger({ module: 'twilio-service' });

/**
 * Generate TwiML to connect the call to a media stream.
 * This is the response to Twilio's incoming call webhook.
 */
export function generateStreamTwiml(callSid: string): string {
  const env = getEnv();
  const wsUrl = env.TWILIO_WEBHOOK_BASE_URL
    .replace('https://', 'wss://')
    .replace('http://', 'ws://');

  // TwiML that:
  // 1. Says a brief welcome (while the AI session initializes)
  // 2. Opens a bidirectional media stream to our WebSocket endpoint
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}/ws/media-stream">
      <Parameter name="callSid" value="${callSid}" />
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Start recording a call via REST API.
 * Used instead of TwiML <Record> because <Connect><Stream> doesn't support inline recording.
 */
export async function startCallRecording(callSid: string): Promise<void> {
  const env = getEnv();

  try {
    const client = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const baseUrl = env.TWILIO_WEBHOOK_BASE_URL;

    await client.calls(callSid).recordings.create({
      recordingStatusCallback: `${baseUrl}/twilio/recording`,
      recordingStatusCallbackMethod: 'POST',
      recordingChannels: 'dual',
    });
    logger.info({ callSid }, 'Call recording started');
  } catch (err) {
    // Non-blocking — recording failure shouldn't break the call
    logger.warn({ err, callSid }, 'Failed to start call recording');
  }
}

/**
 * Transfer a call to a human agent using Twilio's REST API.
 */
export async function transferCall(callSid: string, targetNumber: string): Promise<void> {
  const env = getEnv();

  try {
    const client = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

    // Update the live call with new TwiML that dials the target
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please hold while I transfer you to a team member.</Say>
  <Dial callerId="${env.TWILIO_PHONE_NUMBER}">
    <Number>${targetNumber}</Number>
  </Dial>
</Response>`;

    await client.calls(callSid).update({ twiml });
    logger.info({ callSid, targetNumber }, 'Call transferred');
  } catch (err) {
    logger.error({ err, callSid, targetNumber }, 'Failed to transfer call');
    throw err;
  }
}

/**
 * Validate that a Twilio webhook request is authentic.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const env = getEnv();
  return Twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, params);
}
