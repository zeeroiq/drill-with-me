import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  PORT: number;
  SQLITE_DB_PATH: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  EXECUTION_TIMEOUT_MS: number;
  COMPILE_TIMEOUT_MS: number;
  MAX_CONCURRENT_RUNS: number;
}

export const PORT: number = parseInt(process.env.PORT || '3000', 10);
export const SQLITE_DB_PATH: string = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'data/app.db');
export const ADMIN_USERNAME: string = process.env.ADMIN_USERNAME || 'admin';
export const ADMIN_PASSWORD_HASH: string =
  (process.env.NODE_ENV === 'test' ? undefined : process.env.ADMIN_PASSWORD_HASH) ||
  '490fa53ee18bc825940bd4f0fbd18a29:a9f571813f639e182de57cf0731b1eaac868c92ec6c39468519df3cc03e86e64a90a05f325b40e8398cf582bb37ba9400453048a06df27aa1865a8fa65750010';
export const SESSION_SECRET: string =
  (process.env.NODE_ENV === 'test' ? undefined : process.env.SESSION_SECRET) ||
  'javadrill-super-secret-key-change-in-prod';
export const EXECUTION_TIMEOUT_MS: number = parseInt(process.env.EXECUTION_TIMEOUT_MS || '3000', 10);
export const COMPILE_TIMEOUT_MS: number = parseInt(process.env.COMPILE_TIMEOUT_MS || '5000', 10);
export const MAX_CONCURRENT_RUNS: number = parseInt(process.env.MAX_CONCURRENT_RUNS || '3', 10);

export const config: AppConfig = {
  PORT,
  SQLITE_DB_PATH,
  ADMIN_USERNAME,
  ADMIN_PASSWORD_HASH,
  SESSION_SECRET,
  EXECUTION_TIMEOUT_MS,
  COMPILE_TIMEOUT_MS,
  MAX_CONCURRENT_RUNS,
};

export default config;
