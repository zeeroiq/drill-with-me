import { Router, type Request, type Response } from 'express';
import { spawnSync } from 'node:child_process';
import { getDb } from '../db/index.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  let databaseConnected = false;
  let javaAvailable = false;

  // Check database connectivity
  try {
    const db = getDb();
    const result = db.prepare('SELECT 1 as alive').get();
    if (result) {
      databaseConnected = true;
    }
  } catch (err) {
    console.error('Health check DB error:', err);
  }

  // Check javac and java availability
  try {
    const javacResult = spawnSync('javac', ['-version'], {
      stdio: 'pipe',
      timeout: 10000,
    });
    const javaResult = spawnSync('java', ['-version'], {
      stdio: 'pipe',
      timeout: 10000,
    });
    if (javacResult.status === 0 && javaResult.status === 0) {
      javaAvailable = true;
    }
  } catch (err) {
    console.error('Health check Java error:', err);
  }

  const timestamp = new Date().toISOString();

  if (databaseConnected && javaAvailable) {
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      java: 'available',
      timestamp,
    });
  } else {
    res.status(503).json({
      status: 'error',
      database: databaseConnected ? 'connected' : 'error',
      java: javaAvailable ? 'available' : 'unavailable',
      timestamp,
    });
  }
});

export default healthRouter;
