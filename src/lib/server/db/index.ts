import path from 'node:path';
import { readFileSync } from 'node:fs';

const DB_PATH = path.resolve(process.cwd(), 'db/marketing.db');
const MIGRATIONS = [
  path.resolve(process.cwd(), 'db/migrations/001_schema.sql'),
  path.resolve(process.cwd(), 'db/migrations/002_integrations.sql'),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DatabaseImpl: any;

if (typeof (globalThis as Record<string, unknown>).Bun !== 'undefined') {
  // Running in Bun — use native built-in
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — bun:sqlite only available in Bun runtime
  const mod = await import(/* @vite-ignore */ 'bun:sqlite');
  DatabaseImpl = mod.Database;
} else {
  // Running in Node.js (SvelteKit SSR via Vite) — use better-sqlite3
  const mod = await import('better-sqlite3');
  DatabaseImpl = mod.default;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  if (_db) return _db;
  _db = new DatabaseImpl(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  for (const migration of MIGRATIONS) {
    _db.exec(readFileSync(migration, 'utf-8'));
  }
  return _db;
}
