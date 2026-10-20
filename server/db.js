'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.MOVIEJUKE_DB || path.join(DATA_DIR, 'app.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  price_from   INTEGER NOT NULL DEFAULT 0,
  avg_ticket   INTEGER NOT NULL DEFAULT 0,
  description  TEXT
);

CREATE TABLE IF NOT EXISTS search_terms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword       TEXT NOT NULL UNIQUE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  source        TEXT NOT NULL DEFAULT 'google_organic',
  impressions   INTEGER NOT NULL DEFAULT 0,
  clicks        INTEGER NOT NULL DEFAULT 0,
  position      REAL NOT NULL DEFAULT 0,
  landing_page  TEXT,
  first_seen    TEXT,
  last_seen     TEXT
);

-- Dated report rows are kept separately so re-importing an export replaces the
-- same observation instead of double-counting clicks or impressions.
CREATE TABLE IF NOT EXISTS search_observations (
  term_id       INTEGER NOT NULL REFERENCES search_terms(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,
  source        TEXT NOT NULL,
  landing_page  TEXT NOT NULL DEFAULT '',
  impressions   INTEGER NOT NULL DEFAULT 0,
  clicks        INTEGER NOT NULL DEFAULT 0,
  position      REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (term_id, day, source, landing_page)
);

CREATE TABLE IF NOT EXISTS customer_imports (
  fingerprint TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  city              TEXT,
  product_id        INTEGER REFERENCES products(id) ON DELETE SET NULL,
  search_term_id    INTEGER REFERENCES search_terms(id) ON DELETE SET NULL,
  source            TEXT NOT NULL DEFAULT 'google_organic',
  stage             TEXT NOT NULL DEFAULT 'new',
  budget            INTEGER NOT NULL DEFAULT 0,
  quote_value       INTEGER NOT NULL DEFAULT 0,
  owner             TEXT,
  gclid             TEXT,
  landing_page      TEXT,
  device            TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  last_activity_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  label        TEXT NOT NULL,
  occurred_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

CREATE INDEX IF NOT EXISTS idx_customers_stage      ON customers(stage);
CREATE INDEX IF NOT EXISTS idx_customers_created    ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_product    ON customers(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_term       ON customers(search_term_id);
CREATE INDEX IF NOT EXISTS idx_customers_city       ON customers(city);
CREATE INDEX IF NOT EXISTS idx_events_customer      ON events(customer_id);
CREATE INDEX IF NOT EXISTS idx_events_occurred      ON events(occurred_at);
`;

let db = null;

function connect() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

function isEmpty() {
  const row = connect().prepare('SELECT COUNT(*) AS n FROM customers').get();
  return Number(row.n) === 0;
}

function ensureData() {
  const conn = connect();
  if (!conn.prepare("SELECT value FROM meta WHERE key = 'data_mode'").get() &&
      conn.prepare("SELECT value FROM meta WHERE key = 'seeded_at'").get()) {
    conn.prepare("INSERT INTO meta (key, value) VALUES ('data_mode', 'demo')").run();
  }
  if (isEmpty() && !conn.prepare("SELECT value FROM meta WHERE key = 'data_mode'").get()) {
    const { seed } = require('./seed');
    seed(conn);
    conn.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('data_mode', 'demo')").run();
    conn
      .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('seeded_at', new Date().toISOString());
  }
  return conn;
}

function resetData() {
  const conn = connect();
  conn.exec(`
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS customer_imports;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS search_observations;
    DROP TABLE IF EXISTS search_terms;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS meta;
  `);
  conn.exec(SCHEMA);
  const { seed } = require('./seed');
  seed(conn);
  conn.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('data_mode', 'demo')").run();
  conn
    .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('seeded_at', new Date().toISOString());
  return conn;
}

function replaceDemo() {
  const conn = connect();
  const mode = conn.prepare("SELECT value FROM meta WHERE key = 'data_mode'").get();
  if (mode?.value !== 'demo') {
    const error = new Error('This workspace is not in demo mode. Existing real data was not deleted.');
    error.status = 409;
    throw error;
  }
  conn.exec('BEGIN');
  try {
    conn.exec('DELETE FROM events; DELETE FROM customer_imports; DELETE FROM customers; DELETE FROM search_observations; DELETE FROM search_terms;');
    conn.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('data_mode', 'real')").run();
    conn.prepare("DELETE FROM meta WHERE key = 'seeded_at'").run();
    conn.exec('COMMIT');
  } catch (error) {
    conn.exec('ROLLBACK');
    throw error;
  }
  return conn;
}

module.exports = { connect, ensureData, resetData, replaceDemo, isEmpty, DB_PATH };
