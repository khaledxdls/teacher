import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';

type TokenPayload = { sub: string };

export function signToken(userId: string) {
  return jwt.sign({}, config.jwtSecret, {
    subject: userId,
    expiresIn: config.tokenTtl as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

/** Returns the user id, or null if the token is missing, invalid or expired. */
export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
