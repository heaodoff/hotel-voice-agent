import { vi } from 'vitest';

export const testEnv = {
  NODE_ENV: 'development' as const,
  PORT: 3000,
  HOST: '0.0.0.0',
  LOG_LEVEL: 'silent' as const,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  TWILIO_ACCOUNT_SID: 'ACtest00000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'test_auth_token_000000000000000',
  TWILIO_PHONE_NUMBER: '+10000000000',
  TWILIO_WEBHOOK_BASE_URL: 'https://test.ngrok.io',
  OPENAI_API_KEY: 'sk-test00000000000000000000000000',
  OPENAI_REALTIME_MODEL: 'gpt-4o-realtime-preview-2024-12-17',
  EMAIL_FROM: 'test@hotel.example.com',
  SMTP_HOST: undefined,
  SMTP_PORT: undefined,
  SMTP_USER: undefined,
  SMTP_PASS: undefined,
  DEFAULT_HOTEL_ID: 'hotel_test',
  DEFAULT_HOTEL_NAME: 'Test Hotel',
  DEFAULT_HOTEL_TIMEZONE: 'America/New_York',
  DEFAULT_HOTEL_PHONE: '+10000000001',
  HANDOFF_PHONE_NUMBER: '+10000000002',
};

export function setupEnvMock() {
  vi.mock('../../src/config/index.js', () => ({
    getEnv: () => testEnv,
    loadEnv: () => testEnv,
  }));
}
