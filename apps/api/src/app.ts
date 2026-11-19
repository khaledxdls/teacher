import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from './lib/prisma.js';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed', error);
    response.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});
