import 'dotenv/config';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number');
}

export const config = {
  host: process.env.HOST ?? '0.0.0.0',
  port,
  databaseUrl: process.env.DATABASE_URL,
};
