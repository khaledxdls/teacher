import * as Sentry from '@sentry/node';

let enabled = false;

/** Starts error monitoring when a DSN is configured. Safe to call more than once. */
export function initMonitoring(dsn: string | undefined, environment: string) {
  if (!dsn || enabled) return;
  Sentry.init({ dsn, environment, tracesSampleRate: 0 });
  enabled = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (enabled) Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (enabled) Sentry.captureMessage(message, context ? { level: 'error', extra: context } : 'error');
}
