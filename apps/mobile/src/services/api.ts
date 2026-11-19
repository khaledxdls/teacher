import { SyncRecord } from '../domain/sync';

/**
 * Base URL of the ClassPilot API. Set EXPO_PUBLIC_API_URL in apps/mobile/.env;
 * on a physical device use the computer's LAN IP instead of localhost.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

const TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  /** `status` is 0 when the server could not be reached. */
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export type User = { id: string; email: string; name: string | null };
export type AuthResponse = { token: string; user: User };
export type SyncResponse = { cursor: number; changes: SyncRecord[] };

type RequestOptions = { method?: 'GET' | 'POST'; body?: unknown; token?: string };

async function apiRequest<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Check your connection.`);
  } finally {
    clearTimeout(timeout);
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new ApiError(response.status, payload.error ?? `Request failed (${response.status}).`);
  return payload as T;
}

export const login = (email: string, password: string) =>
  apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });

export const register = (email: string, password: string, name?: string) =>
  apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: { email, password, name: name || undefined } });

export const syncChanges = (token: string, cursor: number, changes: SyncRecord[]) =>
  apiRequest<SyncResponse>('/sync', { method: 'POST', token, body: { cursor, changes } });
