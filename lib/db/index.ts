/**
 * Central DB connection — single instance, auto-migrates on first use.
 * Import getDb() from here; never open Database() directly elsewhere.
 */

import { Database } from 'bun:sqlite';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const DB_PATH        = path.resolve(import.meta.dir, '../../db/marketing.db');
const MIGRATION_PATH = path.resolve(import.meta.dir, '../../db/migrations/001_schema.sql');

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;

  _db = new Database(DB_PATH, { create: true });
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  _db.exec(readFileSync(MIGRATION_PATH, 'utf-8'));

  return _db;
}
