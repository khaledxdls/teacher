import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

function readPort() {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  if (Number.isNaN(port)) throw new Error('PORT must be a valid number');
  return port;
}

function readJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction) throw new Error('JWT_SECRET must be set to at least 32 characters in production');
  if (secret) console.warn('JWT_SECRET is shorter than 32 characters; use a long random value outside development.');
  return secret || 'development-only-secret-do-not-use-in-production';
}

const list = (value: string | undefined) => value?.split(',').map((item) => item.trim()).filter(Boolean);

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port: readPort(),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: readJwtSecret(),
  tokenTtl: process.env.TOKEN_TTL ?? '30d',
  isProduction,
  isTest,
  /** Browser origins allowed to call the API (Expo web). Native apps send no Origin header. */
  corsOrigins: list(process.env.CORS_ORIGINS),
  /** Error monitoring; disabled when unset. */
  sentryDsn: process.env.SENTRY_DSN || undefined,
  mail: {
    /** Sends real email through Resend when set; otherwise emails are logged to the console. */
    resendApiKey: process.env.RESEND_API_KEY || undefined,
    from: process.env.MAIL_FROM ?? 'ClassPilot <no-reply@classpilot.app>',
  },
  passwordReset: {
    codeTtlMinutes: 15,
    maxAttempts: 5,
  },
} as const;

export type AppConfig = typeof config;
