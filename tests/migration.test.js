'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// Simulate a previously saved database: migration must never delete enquiries.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moviejuke-upgrade-'));
process.env.MOVIEJUKE_DB = path.join(dir, 'existing.db');

const legacy = new DatabaseSync(process.env.MOVIEJUKE_DB);
legacy.exec(`CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT,
  city TEXT, product_id INTEGER, search_term_id INTEGER, source TEXT,
  stage TEXT, budget INTEGER, quote_value INTEGER, owner TEXT, gclid TEXT,
  landing_page TEXT, device TEXT, notes TEXT, created_at TEXT, last_activity_at TEXT
);
INSERT INTO customers (name, phone, city, source, stage, created_at, last_activity_at)
  VALUES ('Existing Test Record', '+910000000004', 'Bengaluru', 'direct', 'new',
  '2023-01-02T12:00:00.000Z', '2023-01-02T12:00:00.000Z');`);
legacy.close();

const { connect } = require('../server/db');
const q = require('../server/queries');

test('adds lead address and interest columns without erasing existing records', (t) => {
  t.after(() => { connect().close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const db = connect();
  const columnNames = new Set(db.prepare('PRAGMA table_info(customers)').all().map((col) => col.name));
  for (const key of ['interest', 'property_name', 'pin_code']) assert.ok(columnNames.has(key));
  const oldLead = q.listCustomers({ from: '2023-01-01', to: '2023-01-02' });
  assert.equal(oldLead.total, 1);
  assert.equal(oldLead.rows[0].name, 'Existing Test Record');
  assert.equal(oldLead.rows[0].propertyName, null);
  const updated = q.updateCustomer(oldLead.rows[0].id, { propertyName: 'Test Building', pinCode: '000123', interest: 'Sheer curtains' });
  assert.equal(updated.propertyName, 'Test Building');
  assert.equal(updated.pinCode, '000123');
  assert.equal(updated.interest, 'Sheer curtains');
});
