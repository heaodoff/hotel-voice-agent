import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  TWILIO_ACCOUNT_SID: z.string().startsWith('AC'),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
  TWILIO_WEBHOOK_BASE_URL: z.string().url(),

  OPENAI_API_KEY: z.string().startsWith('sk-'),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-4o-realtime-preview-2024-12-17'),

  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  DEFAULT_HOTEL_ID: z.string().default('hotel_001'),
  DEFAULT_HOTEL_NAME: z.string().default('Grand Plaza Hotel'),
  DEFAULT_HOTEL_TIMEZONE: z.string().default('America/New_York'),
  DEFAULT_HOTEL_PHONE: z.string().default('+1234567890'),

  HANDOFF_PHONE_NUMBER: z.string().default('+1234567891'),

  // Security
  ADMIN_API_KEY: z.string().min(16).optional(), // API key for admin endpoints
  VALIDATE_TWILIO_SIGNATURE: z.enum(['true', 'false']).default('false'), // Enable in production

  // Rate limiting
  RATE_LIMIT_WEBHOOK_RPM: z.coerce.number().default(120), // requests per minute for Twilio webhooks
  RATE_LIMIT_API_RPM: z.coerce.number().default(60), // requests per minute for API endpoints
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) return loadEnv();
  return _env;
}
