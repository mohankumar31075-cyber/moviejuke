// Tiny JSON file store — fast to boot, easy to inspect, good enough for the demo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '.server-data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db;
let saveTimer = null;

export function getDb() {
  if (!db) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
      db = buildSeed();
      persistNow();
    }
  }
  return db;
}

export function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 250);
}

export function persistNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1));
  } catch (err) {
    console.error('Could not persist db:', err.message);
  }
}

export function resetDb() {
  db = buildSeed();
  persistNow();
  return db;
}
