import type { Request, Response, NextFunction } from 'express';
import { SESSION_SECRET } from '../config.js';
import { createSessionToken, verifySessionToken } from '../utils/crypto.js';
import '../types.js';

export const ADMIN_COOKIE_NAME = 'admin_session';
const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_LOGIN_ATTEMPTS = 5;

// In-memory rate limiting store: IP -> array of timestamps
const loginAttempts = new Map<string, number[]>();

export function resetLoginRateLimits(): void {
  loginAttempts.clear();
}

/**
 * Middleware: Rate limit POST /api/admin/login to 5 attempts per minute per IP.
 */
export function adminLoginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.clientIp || req.socket?.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const windowStart = now - LOGIN_RATE_LIMIT_WINDOW_MS;

  const timestamps = loginAttempts.get(ip) || [];
  const validTimestamps = timestamps.filter((t) => t > windowStart);

  if (validTimestamps.length >= MAX_LOGIN_ATTEMPTS) {
    res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });
    return;
  }

  validTimestamps.push(now);
  loginAttempts.set(ip, validTimestamps);
  next();
}

/**
 * Sets the signed admin_session cookie.
 */
export function setAdminSessionCookie(res: Response, username: string): string {
  const token = createSessionToken(username, SESSION_SECRET);
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  return token;
}

/**
 * Clears the admin_session cookie.
 */
export function clearAdminSessionCookie(res: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
  });
}

/**
 * Middleware: Protects admin routes. Verifies admin_session cookie.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];

  if (!token || typeof token !== 'string') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const session = verifySessionToken(token, SESSION_SECRET);
  if (!session || !session.username) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.admin = { username: session.username };
  next();
}
