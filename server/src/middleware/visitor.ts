import type { Request, Response, NextFunction } from 'express';
import { validate as uuidValidate, v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import '../types.js';

const STATIC_EXTENSIONS_REGEX = /\.(js|css|png|jpg|jpeg|gif|svg|ico|map|woff|woff2|ttf|eot|webp|avif)$/i;

export function visitorMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    let visitorId = req.cookies?.visitor_id;

    if (!visitorId || typeof visitorId !== 'string' || !uuidValidate(visitorId)) {
      visitorId = uuidv4();
      res.cookie('visitor_id', visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
      if (!req.cookies) {
        req.cookies = {};
      }
      req.cookies.visitor_id = visitorId;
    }

    // Resolve IP address
    const forwarded = req.headers['x-forwarded-for'];
    let clientIp = '127.0.0.1';
    if (typeof forwarded === 'string' && forwarded.trim()) {
      clientIp = forwarded.split(',')[0].trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      clientIp = forwarded[0].trim();
    } else if (req.socket?.remoteAddress) {
      clientIp = req.socket.remoteAddress;
    }

    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    req.visitorId = visitorId;
    req.clientIp = clientIp;

    // Database tracking
    const db = getDb();

    // Upsert visitor record
    const upsertVisitor = db.prepare(`
      INSERT INTO visitors (id, ip_address, user_agent, first_seen_at, last_seen_at, visit_count)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
      ON CONFLICT(id) DO UPDATE SET
        last_seen_at = CURRENT_TIMESTAMP,
        visit_count = visitors.visit_count + 1,
        ip_address = excluded.ip_address,
        user_agent = excluded.user_agent
    `);
    upsertVisitor.run(visitorId, clientIp, userAgent);

    // Track page visit / API call (filter out static assets)
    const requestPath = req.path || '/';
    const isStatic = STATIC_EXTENSIONS_REGEX.test(requestPath);

    if (!isStatic) {
      const recordVisit = db.prepare(`
        INSERT INTO page_visits (visitor_id, path, visited_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      recordVisit.run(visitorId, requestPath);
    }
  } catch (err) {
    console.error('Visitor middleware error:', err);
  }

  next();
}
