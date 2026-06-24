import 'server-only';

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { nowIso } from '@/lib/utils';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'hethongsub.db');
const require = createRequire(import.meta.url);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

type RunResult = { changes?: number; lastInsertRowid?: number | bigint };
type Statement = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => RunResult;
};
type SyncDb = {
  exec: (sql: string) => unknown;
  prepare: (sql: string) => Statement;
};

function createDb(filePath: string): SyncDb {
  try {
    const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SyncDb };
    return new DatabaseSync(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
    const BetterSqlite3 = require('better-sqlite3') as new (path: string) => SyncDb;
    return new BetterSqlite3(filePath);
  }
}

const globalForDb = globalThis as unknown as { hethongsubDb?: SyncDb };

export const db = globalForDb.hethongsubDb || createDb(dbPath);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.hethongsubDb = db;
}

const isNextBuild =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.npm_lifecycle_event === 'build';

db.exec('PRAGMA busy_timeout = 5000');
db.exec('PRAGMA foreign_keys = ON');

function columnExists(table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function addColumn(table: string, column: string, definition: string) {
  if (!columnExists(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      balance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'manual',
      content TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT NOT NULL DEFAULT '',
      external_ref TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      ref_type TEXT NOT NULL DEFAULT '',
      ref_id INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS service_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      service_key TEXT NOT NULL,
      provider_id INTEGER NOT NULL DEFAULT 0,
      upstream_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT '',
      min_qty INTEGER NOT NULL DEFAULT 0,
      max_qty INTEGER NOT NULL DEFAULT 0,
      base_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      raw_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source, service_key, provider_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      service_key TEXT NOT NULL,
      provider_id INTEGER NOT NULL DEFAULT 0,
      service_name TEXT NOT NULL,
      link TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      comments TEXT NOT NULL DEFAULT '',
      buyer_info TEXT NOT NULL DEFAULT '',
      custom_value TEXT NOT NULL DEFAULT '',
      amount INTEGER NOT NULL,
      source_amount INTEGER NOT NULL DEFAULT 0,
      profit_amount INTEGER NOT NULL DEFAULT 0,
      upstream_order TEXT NOT NULL DEFAULT '',
      upstream_status TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT NOT NULL DEFAULT '',
      raw_response TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  addColumn('orders', 'comments', "TEXT NOT NULL DEFAULT ''");
  addColumn('orders', 'buyer_info', "TEXT NOT NULL DEFAULT ''");
  addColumn('orders', 'custom_value', "TEXT NOT NULL DEFAULT ''");
  addColumn('orders', 'source_amount', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('orders', 'profit_amount', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'full_name', "TEXT NOT NULL DEFAULT ''");
  addColumn('users', 'avatar_url', "TEXT NOT NULL DEFAULT ''");
  addColumn('service_prices', 'platform', "TEXT NOT NULL DEFAULT ''");

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
  if (!existing) {
    const now = nowIso();
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.prepare(`
      INSERT INTO users (username, email, password_hash, role, status, balance, created_at, updated_at)
      VALUES (?, ?, ?, 'admin', 'active', 0, ?, ?)
    `).run(adminUsername, `${adminUsername}@hethongsub.vn`, hash, now, now);
  }
}

if (!isNextBuild) {
  db.exec('PRAGMA journal_mode = WAL');
  initDb();
}

export type UserRow = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: string;
  status: string;
  balance: number;
  created_at: string;
  updated_at: string;
};

export function runTx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
