import { SignJWT, jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';
import { env } from './utils.js';

const secret = new TextEncoder().encode(env('JWT_SECRET'));

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; email: string };
}

export async function signAccessToken(payload: { sub: string; email: string }) {
  return await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  return { sub: payload.sub as string, email: payload.email as string };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing Authorization header' });
  const [, token] = header.split(' ');
  if (!token) return res.status(401).json({ error: 'Malformed Authorization header' });
  verifyAccessToken(token)
    .then(({ sub, email }) => {
      req.user = { sub, email };
      next();
    })
    .catch(() => res.status(401).json({ error: 'Invalid or expired token' }));
}
