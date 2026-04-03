import { getEnv } from '../../config/index.js';
import { createChildLogger } from '../../lib/logger.js';

const logger = createChildLogger({ module: 'telnyx-service' });

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

function getHeaders(): Record<string, string> {
  const env = getEnv();
  return {
    'Authorization': `Bearer ${env.TELNYX_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function telnyxRequest(path: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const url = `${TELNYX_API_BASE}${path}`;
  logger.debug({ url, body }, 'Telnyx API request');

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    logger.error({ url, status: res.status, data }, 'Telnyx API error');
    throw new Error(`Telnyx API error: ${res.status} ${JSON.stringify(data)}`);
  }

  logger.debug({ url, status: res.status }, 'Telnyx API success');
  return data;
}

/** Answer an inbound call */
export async function answerCall(callControlId: string): Promise<void> {
  await telnyxRequest(`/calls/${callControlId}/actions/answer`, {});
}

/** Start bidirectional media streaming to our WebSocket */
export async function startStreaming(callControlId: string, streamUrl: string): Promise<void> {
  await telnyxRequest(`/calls/${callControlId}/actions/streaming_start`, {
    stream_url: streamUrl,
    stream_track: 'inbound_track',
    stream_bidirectional_mode: 'rtp',
    stream_bidirectional_codec: 'PCMU',
  });
}

/** Hang up a call */
export async function hangupCall(callControlId: string): Promise<void> {
  await telnyxRequest(`/calls/${callControlId}/actions/hangup`, {});
}

/** Transfer call to a phone number */
export async function transferCall(callControlId: string, toNumber: string): Promise<void> {
  await telnyxRequest(`/calls/${callControlId}/actions/transfer`, {
    to: toNumber,
  });
}
