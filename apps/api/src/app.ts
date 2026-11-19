import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler } from './lib/http.js';
import { prisma } from './lib/prisma.js';
import { authRouter } from './routes/auth.js';
import { syncRouter } from './routes/sync.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
// Native apps send no Origin header. Browsers (Expo web) are allowed only from CORS_ORIGINS,
// or from anywhere in development when it is not set.
app.use(cors({ origin: config.corsOrigins ?? !config.isProduction }));
app.use(express.json({ limit: '2mb' }));
if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));

app.get('/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed', error);
    response.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.use('/auth', authRouter);
app.use('/sync', syncRouter);

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
