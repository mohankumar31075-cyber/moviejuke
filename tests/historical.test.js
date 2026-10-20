'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moviejuke-history-'));
process.env.MOVIEJUKE_DB = path.join(dir, 'history.db');
process.env.MOVIEJUKE_ADMIN_PASSWORD = 'test-password-never-for-production';
const app = require('../server/index');
const { connect, ensureData } = require('../server/db');
const { dayFrom } = require('../server/search-import');

const basic = { Authorization: `Basic ${Buffer.from(`admin:${process.env.MOVIEJUKE_ADMIN_PASSWORD}`).toString('base64')}` };

test('dated export imports, authentication, deduplication and historical coverage', async (t) => {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => { server.close(); connect().close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, options = {}) => {
    const response = await fetch(`${base}${route}`, options);
    const body = await response.text();
    let data;
    try { data = JSON.parse(body); } catch { data = body; }
    return { status: response.status, data };
  };
  const csv = (body, auth = true) => ({ method: 'POST', headers: { 'Content-Type': 'text/csv', ...(auth ? basic : {}) }, body });

  assert.equal(dayFrom('31/02/2023'), null);
  assert.equal(dayFrom('20/10/2026'), '2026-10-20');
  assert.equal((await request('/api/reference')).data.customerCount, 248);
  const archive = await request('/leads');
  assert.equal(archive.status, 200);
  assert.match(archive.data, /Lead archive · Moviejuke Interiors/);
  assert.match(archive.data, /id="lead-rows"/);
  const template = await request('/api/import/lead-template');
  assert.equal(template.status, 200);
  assert.equal(template.data, 'Lead,Phone Number,Interested In,Search Term,Property Name,Pin Code,Enquiry Date\n');
  const demoExport = await fetch(`${base}/api/export?from=2023-01-01&to=2026-10-20`);
  assert.match(demoExport.headers.get('content-disposition'), /moviejuke-DEMO-leads-2023-01-01-to-2026-10-20\.csv/);
  assert.equal((await request('/api/import/search', csv('date,query,impressions,clicks\n2023-01-01,blinds,9,2', false))).status, 409);
  assert.equal((await request('/api/demo/replace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'REPLACE DEMO DATA' }) })).status, 200);
  assert.equal((await request('/api/reference')).status, 401);
  assert.equal((await request('/', { headers: basic })).status, 200);
  assert.equal((await request('/leads')).status, 401);
  assert.equal((await request('/leads', { headers: basic })).status, 200);
  assert.equal((await request('/api/reference', { headers: basic })).data.customerCount, 0);

  const report = 'Date,Top queries,Impressions,Clicks,Position,Landing page\n2023-01-01,Blackout curtains Bangalore,100,8,2.3,/home\n2023-01-01,Blackout curtains Bangalore,25,2,2.5,/home\n2026-10-20,Roller blinds Bengaluru,200,16,3.1,/blinds\n2027-01-01,Outside window,10,1,1,/home\nbad,Bad date,8,1,3,/home\n';
  let result = await request('/api/import/search?from=2023-01-01&to=2026-10-20', csv(report));
  assert.equal(result.data.imported, 2);
  assert.equal(result.data.outOfRange, 1);
  assert.equal(result.data.skipped, 1);
  assert.equal((await request('/api/import/search?from=2023-01-01&to=2026-10-20', csv(report))).data.imported, 2);
  assert.equal(connect().prepare("SELECT clicks FROM search_terms WHERE keyword = 'blackout curtains bangalore'").get().clicks, 10);

  result = await request('/api/import/search?source=google_ads', csv('Search terms report\nJanuary 2023 - October 2026\ndate,Search term,Impr.,Clicks\n2023-01-01,Blackout curtains Bangalore,70,7'));
  assert.equal(result.data.imported, 1);
  assert.equal((await request('/api/search-terms?source=google_ads', { headers: basic })).data.rows.find((row) => row.keyword === 'blackout curtains bangalore').clicks, 7);
  assert.equal((await request('/api/search-terms?source=google_organic', { headers: basic })).data.rows.find((row) => row.keyword === 'blackout curtains bangalore').clicks, 10);

  const enquiries = 'Lead,Phone Number,Interested In,Search Term,Property Name,Pin Code,Enquiry Date,Stage\nFixture Enquiry,+910000000001,Custom Window Film,blackout curtains bangalore,Fixture Towers,000123,2023-01-05,won\nToo Old,+910000000002,Roller Blinds,roller blinds bengaluru,Old Flats,560001,2022-12-31,new\nNo Date,+910000000003,Roller Blinds,roller blinds bengaluru,Missing Date,560001,,new\n';
  result = await request('/api/import?from=2023-01-01&to=2026-10-20', csv(enquiries));
  assert.equal(result.data.imported, 1);
  assert.equal(result.data.skipped, 2);
  assert.equal((await request('/api/import?from=2023-01-01&to=2026-10-20', csv(enquiries))).data.imported, 0);
  assert.equal((await request('/api/reference', { headers: basic })).data.customerCount, 1);
  assert.equal((await request('/api/customers?from=2023-01-01&to=2023-01-05', { headers: basic })).data.total, 1);
  const lead = (await request('/api/customers?from=2023-01-01&to=2023-01-05', { headers: basic })).data.rows[0];
  assert.equal(lead.name, 'Fixture Enquiry');
  assert.equal(lead.phone, '+910000000001');
  assert.equal(lead.interest, 'Custom Window Film'); // unmatched interest is not thrown away
  assert.equal(lead.productName, null);
  assert.equal(lead.propertyName, 'Fixture Towers');
  assert.equal(lead.pinCode, '000123'); // never coerce postal codes to numbers
  assert.equal((await request('/api/customers?q=000123', { headers: basic })).data.total, 1);
  assert.equal((await request('/api/customers?from=2023-01-01&to=2023-01-04', { headers: basic })).data.total, 0);
  const filteredExport = await request('/api/export?from=2023-01-01&to=2023-01-05', { headers: basic });
  assert.equal(filteredExport.status, 200);
  assert.match(filteredExport.data, /Fixture Enquiry/);
  assert.doesNotMatch(filteredExport.data, /Too Old/);
  const leadExport = await request('/api/export/leads?from=2023-01-01&to=2023-01-05', { headers: basic });
  assert.equal(leadExport.status, 200);
  assert.match(leadExport.data, /^Lead,Phone Number,Interested In,Search Term,Property Name,Pin Code,Enquiry Date\n/);
  assert.match(leadExport.data, /Fixture Enquiry,\+910000000001,Custom Window Film,blackout curtains bangalore,Fixture Towers,000123,2023-01-05/);
  const exportHeaders = await fetch(`${base}/api/export?from=2023-01-01&to=2023-01-05`, { headers: basic });
  assert.match(exportHeaders.headers.get('content-disposition'), /moviejuke-leads-2023-01-01-to-2023-01-05\.csv/);
  const history = (await request('/api/history?from=2023-01-01&to=2026-10-20', { headers: basic })).data;
  assert.equal(history.totals.impressions, 395);
  assert.equal(history.totals.customers, 1);
  assert.equal(history.months.length, 2);
  const submitted = await request('/api/customers', {
    method: 'POST', headers: { ...basic, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Form Fixture', phone: '+910000000005', propertyName: 'Captured Property', pinCode: '000456' }),
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.data.propertyName, 'Captured Property');
  assert.equal(submitted.data.pinCode, '000456');
  connect().prepare('DELETE FROM customers').run();
  ensureData();
  assert.equal((await request('/api/reference', { headers: basic })).data.customerCount, 0);
});
