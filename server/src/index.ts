import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import type { Server } from 'node:http';

import { PORT } from './config.js';
import { initDb, closeDb } from './db/index.js';
import { visitorMiddleware } from './middleware/visitor.js';
import { healthRouter } from './routes/health.js';
import { problemsRouter } from './routes/problems.js';
import { executeRouter } from './routes/execute.js';
import { adminRouter } from './routes/admin.js';
import { adminProblemsRouter } from './routes/admin-problems.js';
import { adminCustomProblemsRouter } from './routes/admin-custom-problems.js';
import { customProblemsRouter } from './routes/custom-problems.js';
import './types.js';

export const app = express();

// 1. Core middlewares
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());

// 2. Visitor tracking middleware (assigns visitor_id and logs visits)
app.use(visitorMiddleware);

// 3. API Routes
app.use(healthRouter);
app.use('/api/problems', problemsRouter);
app.use('/api/problems', executeRouter);
app.use('/api/custom-problems', customProblemsRouter);
app.use('/api/admin/problems', adminProblemsRouter);
app.use('/api/admin/custom-problems', adminCustomProblemsRouter);
app.use('/api/admin', adminRouter);

// 4. Static asset serving & SPA fallback
const possibleDistPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
];

const clientDistPath = possibleDistPaths.find((p) => fs.existsSync(p)) || possibleDistPaths[0];

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

let server: Server | null = null;
let isShuttingDown = false;

function shutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}. Shutting down gracefully...`);

  // Safety timeout: forcibly exit after 5000ms if connections remain open,
  // ensuring completion well inside Cloud Run's 10-second SIGTERM grace period.
  const forceExitTimer = setTimeout(() => {
    console.warn('Graceful shutdown timed out after 5000ms. Forcibly closing database and exiting.');
    try {
      closeDb();
    } catch (err) {
      console.error('Error closing database during forced shutdown:', err);
    }
    process.exit(0);
  }, 5000);

  forceExitTimer.unref();

  if (server) {
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }

    server.close((err) => {
      clearTimeout(forceExitTimer);
      if (err) {
        console.error('Error closing HTTP server:', err);
      } else {
        console.log('HTTP server closed.');
      }
      try {
        closeDb();
      } catch (dbErr) {
        console.error('Error closing database:', dbErr);
      }
      process.exit(0);
    });
  } else {
    clearTimeout(forceExitTimer);
    try {
      closeDb();
    } catch (dbErr) {
      console.error('Error closing database:', dbErr);
    }
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (process.env.NODE_ENV !== 'test') {
  initDb();
  server = app.listen(PORT, () => {
    console.log(`JavaDrill server running on port ${PORT}`);
  });
}

export default app;
