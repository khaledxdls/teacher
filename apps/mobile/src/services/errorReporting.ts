import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_URL } from './api';

/**
 * Reports unexpected errors to the API (`POST /client-errors`), which forwards them to
 * monitoring. Uses plain fetch so it works in Expo Go without native SDKs, and never throws.
 */
export function reportError(error: unknown, context: Record<string, string | number | boolean> = {}) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  if (__DEV__) console.warn(`[reportError] ${normalized.message}`, context);
  if (process.env.NODE_ENV === 'test') return;

  fetch(`${API_URL}/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: normalized.message.slice(0, 1_000),
      stack: normalized.stack?.slice(0, 10_000),
      context: {
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version ?? 'unknown',
        ...context,
      },
    }),
  }).catch(() => undefined);
}

type GlobalHandler = (error: Error, fatal?: boolean) => void;
type ErrorUtilsShape = { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (handler: GlobalHandler) => void };

let installed = false;

/** Reports uncaught JS errors (in addition to React Native's default handling). */
export function installGlobalErrorHandler() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (installed || !errorUtils) return;
  installed = true;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, fatal) => {
    reportError(error, { fatal: Boolean(fatal), where: 'global' });
    previous(error, fatal);
  });
}
