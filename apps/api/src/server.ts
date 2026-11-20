import { createApp } from './app.js';
import { config } from './config.js';
import { createMailer } from './lib/mailer.js';
import { initMonitoring } from './lib/monitoring.js';
import { prisma } from './lib/prisma.js';

initMonitoring(config.sentryDsn, process.env.NODE_ENV ?? 'development');

if (config.isProduction && !config.mail.resendApiKey) {
  console.warn('RESEND_API_KEY is not set: password reset emails will only be logged.');
}

const app = createApp({ mailer: createMailer(config.mail) });

const server = app.listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
