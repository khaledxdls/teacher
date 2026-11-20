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

  get isNetworkError() {
    return this.status === 0;
  }
}

export type User = { id: string; email: string; name: string | null };
export type AuthResponse = { token: string; user: User };
export type SyncResponse = { cursor: number; changes: SyncRecord[] };

type RequestOptions = { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; token?: string };

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
    throw new ApiError(0, `Can't reach the server at ${API_URL}.`);
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new ApiError(response.status, payload.error ?? `Request failed (${response.status}).`);
  return payload as T;
}

const post = <T>(path: string, body: unknown, token?: string) => apiRequest<T>(path, { method: 'POST', body, token });

export const api = {
  login: (email: string, password: string) => post<AuthResponse>('/auth/login', { email, password }),
  register: (email: string, password: string, name?: string) =>
    post<AuthResponse>('/auth/register', { email, password, name: name || undefined }),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    post<AuthResponse>('/auth/password', { currentPassword, newPassword }, token),
  requestPasswordReset: (email: string) => post<{ message: string }>('/auth/password/forgot', { email }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    post<AuthResponse>('/auth/password/reset', { email, code, newPassword }),
  deleteAccount: (token: string, password: string) => apiRequest<void>('/auth/me', { method: 'DELETE', token, body: { password } }),
  sync: (token: string, cursor: number, changes: SyncRecord[]) => post<SyncResponse>('/sync', { cursor, changes }, token),
};
