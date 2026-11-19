import 'dotenv/config';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number');
}

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction) throw new Error('JWT_SECRET must be set to at least 32 characters in production');
  if (secret) console.warn('JWT_SECRET is shorter than 32 characters; use a long random value outside development.');
  return secret || 'development-only-secret-do-not-use-in-production';
}

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: jwtSecret(),
  tokenTtl: process.env.TOKEN_TTL ?? '30d',
  isProduction,
  isTest,
  /** Comma-separated list of allowed browser origins; native apps do not send an Origin header. */
  corsOrigins: process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean),
};
