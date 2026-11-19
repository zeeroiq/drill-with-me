import DatabaseConstructor from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { SQLITE_DB_PATH } from '../config.js';
import { runMigrations, type DatabaseInstance } from './schema.js';
import { seedProblems } from './seed.js';

let dbInstance: DatabaseInstance | null = null;

export function initDb(customDbPath?: string): DatabaseInstance {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customDbPath || SQLITE_DB_PATH;

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseConstructor(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  runMigrations(db);
  seedProblems(db);

  dbInstance = db;
  return dbInstance;
}

export function getDb(): DatabaseInstance {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export * from './schema.js';
export * from './seed.js';
