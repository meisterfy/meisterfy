/**
 * Central DB connection — single instance, auto-migrates on first use.
 * Import getDb() from here; never open Database() directly elsewhere.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH        = path.resolve(__dirname, '../../db/marketing.db');
const MIGRATION_PATH = path.resolve(__dirname, '../../db/migrations/001_schema.sql');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  _db.exec(readFileSync(MIGRATION_PATH, 'utf-8'));

  return _db;
}
