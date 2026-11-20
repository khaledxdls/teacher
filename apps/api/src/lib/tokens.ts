import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';

type TokenPayload = { sub?: string; ver?: number };
export type TokenClaims = { userId: string; tokenVersion: number };

/** Signs a session token. `tokenVersion` lets a password change revoke every older token. */
export function signToken(userId: string, tokenVersion: number) {
  return jwt.sign({ ver: tokenVersion }, config.jwtSecret, {
    subject: userId,
    expiresIn: config.tokenTtl as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

/** Returns the token's claims, or null if it is missing, invalid or expired. */
export function verifyToken(token: string): TokenClaims | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
    if (typeof payload.sub !== 'string') return null;
    return { userId: payload.sub, tokenVersion: typeof payload.ver === 'number' ? payload.ver : 0 };
  } catch {
    return null;
  }
}
