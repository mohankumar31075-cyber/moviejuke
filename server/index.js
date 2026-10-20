'use strict';

const path = require('node:path');
const express = require('express');
const { connect, ensureData, resetData, DB_PATH } = require('./db');
const q = require('./queries');
const { parseCsv, toObjects, toCsv } = require('./csv');

const app = express();
const PORT = Number(process.env.PORT) || 4300;
const HOST = process.env.HOST || '0.0.0.0';

app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '8mb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

// ---------- reference data ----------

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: DB_PATH, uptime: process.uptime() });
});

app.get('/api/reference', (req, res) => {
  res.json(q.getFilterOptions());
});

app.get('/api/products', (req, res) => {
  res.json({ rows: q.listProducts() });
});

// ---------- dashboard ----------

app.get('/api/overview', (req, res) => {
  const days = Math.min(120, Math.max(7, Number(req.query.days) || 30));
  res.json(q.getOverview({ days }));
});

// ---------- search terms ----------

app.get('/api/search-terms', (req, res) => {
  res.json(
    q.listSearchTerms({
      q: req.query.q ? String(req.query.q) : '',
      productId: req.query.productId || '',
      source: req.query.source || '',
      sort: req.query.sort || 'leads',
    }),
  );
});

// ---------- customers ----------

app.get('/api/customers', (req, res) => {
  const stages = String(req.query.stage || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  res.json(
    q.listCustomers({
      q: req.query.q ? String(req.query.q) : '',
      productId: req.query.productId || '',
      termId: req.query.termId || '',
      stages,
      source: req.query.source || '',
      city: req.query.city || '',
      from: req.query.from || '',
      to: req.query.to || '',
      minBudget: req.query.minBudget || '',
      channel: req.query.channel || '',
      sort: req.query.sort || 'newest',
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 12,
    }),
  );
});

app.get('/api/customers/:id', (req, res) => {
  const customer = q.getCustomer(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ ...customer, reference: `MJ-${String(customer.id).padStart(4, '0')}` });
});

app.post('/api/customers', (req, res) => {
  const body = req.body || {};
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ error: 'A customer name is required.' });
  }
  const customer = q.createCustomer(body);
  res.status(201).json(customer);
});

app.patch('/api/customers/:id', (req, res) => {
  const updated = q.updateCustomer(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Customer not found' });
  res.json(updated);
});

app.post('/api/customers/:id/events', (req, res) => {
  const customer = q.getCustomer(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const { type = 'note', label, occurredAt } = req.body || {};
  if (!label || !String(label).trim()) {
    return res.status(400).json({ error: 'An activity description is required.' });
  }
  q.addEvent(customer.id, String(type), String(label).trim(), occurredAt);
  connect()
    .prepare('UPDATE customers SET last_activity_at = ? WHERE id = ?')
    .run(occurredAt || new Date().toISOString(), customer.id);
  res.status(201).json(q.getCustomer(customer.id));
});

// ---------- CSV import / export ----------

const FIELD_ALIASES = {
  name: ['name', 'customer', 'customer_name', 'full_name', 'contact', 'contact_name', 'lead', 'lead_name'],
  email: ['email', 'email_address', 'mail', 'e_mail'],
  phone: ['phone', 'phone_number', 'mobile', 'contact_number', 'whatsapp', 'tel'],
  city: ['city', 'location', 'town'],
  product: ['product', 'product_name', 'product_searched', 'service', 'service_interest', 'interested_in'],
  keyword: ['keyword', 'search_term', 'query', 'search_query', 'google_search', 'searched_for', 'search_keyword'],
  stage: ['stage', 'status', 'pipeline_stage', 'lead_status'],
  source: ['source', 'channel', 'lead_source', 'search_source'],
  budget: ['budget', 'budget_inr', 'budget_amount', 'est_budget', 'estimated_budget'],
  quoteValue: ['quote_value', 'quote', 'quotation', 'quote_amount', 'deal_value', 'value'],
  owner: ['owner', 'sales_rep', 'assigned_to', 'executive'],
  notes: ['notes', 'note', 'remarks', 'comment', 'comments'],
  createdAt: ['created_at', 'date', 'enquiry_date', 'lead_date', 'created', 'timestamp'],
  landingPage: ['landing_page', 'page', 'url', 'landing_url'],
  gclid: ['gclid', 'click_id', 'google_click_id'],
  device: ['device', 'device_type'],
  impressions: ['impressions', 'impr', 'search_impressions'],
  clicks: ['clicks', 'search_clicks'],
  position: ['position', 'avg_position', 'rank'],
};

const STAGE_INPUT = new Map([
  ['new', 'new'], ['new enquiry', 'new'], ['new enquiry', 'new'], ['enquiry', 'new'], ['lead', 'new'],
  ['open', 'new'], ['fresh', 'new'],
  ['contacted', 'contacted'], ['called', 'contacted'], ['in progress', 'contacted'], ['in_progress', 'contacted'],
  ['qualified', 'qualified'], ['qualify', 'qualified'], ['hot', 'qualified'], ['site visit', 'qualified'],
  ['quoted', 'quoted'], ['quote sent', 'quoted'], ['quote_sent', 'quoted'], ['proposal', 'quoted'],
  ['won', 'won'], ['closed won', 'won'], ['booked', 'won'], ['converted', 'won'], ['closed_won', 'won'],
  ['lost', 'lost'], ['closed lost', 'lost'], ['dropped', 'lost'], ['closed_lost', 'lost'], ['dead', 'lost'],
]);

const SOURCE_INPUT = new Map([
  ['google', 'google_organic'], ['organic', 'google_organic'], ['google organic', 'google_organic'],
  ['seo', 'google_organic'], ['google_organic', 'google_organic'],
  ['google ads', 'google_ads'], ['google_ads', 'google_ads'], ['ads', 'google_ads'], ['ppc', 'google_ads'],
  ['paid', 'google_ads'], ['cpc', 'google_ads'],
  ['shopping', 'google_shopping'], ['google shopping', 'google_shopping'], ['google_shopping', 'google_shopping'],
  ['direct', 'direct'], ['referral', 'referral'], ['instagram', 'social'], ['facebook', 'social'],
  ['whatsapp', 'whatsapp'], ['walk in', 'walk_in'], ['walk-in', 'walk_in'],
]);

function valueFor(record, field) {
  for (const alias of FIELD_ALIASES[field] || []) {
    if (record[alias] !== undefined && record[alias] !== '') return record[alias];
  }
  return '';
}

function normalizeStage(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return 'new';
  return STAGE_INPUT.get(key) || (q.STAGE_ORDER.includes(key) ? key : 'new');
}

function normalizeSource(raw, hasKeyword) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return hasKeyword ? 'google_organic' : 'direct';
  if (SOURCE_INPUT.has(key)) return SOURCE_INPUT.get(key);
  if (key.startsWith('google')) return 'google_organic';
  return key.replace(/\s+/g, '_').slice(0, 40);
}

function normalizeDate(raw) {
  if (!raw) return new Date().toISOString();
  const trimmed = String(raw).trim();
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const fallback = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    if (!Number.isNaN(fallback.getTime())) return fallback.toISOString();
  }
  return new Date().toISOString();
}

function normalizeNumber(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[₹,\s]/g, '').replace(/inr/gi, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function runImport(csvText) {
  const { headers, records } = toObjects(parseCsv(csvText));
  if (!headers.length) throw Object.assign(new Error('The file appears to be empty.'), { status: 400 });
  if (!records.length) throw Object.assign(new Error('No data rows found below the header.'), { status: 400 });

  const required = FIELD_ALIASES.name;
  if (!headers.some((h) => required.includes(h))) {
    throw Object.assign(
      new Error(`Could not find a name column. Expected one of: ${required.join(', ')}.`),
      { status: 400 },
    );
  }

  const products = new Map(q.listProducts().map((p) => [p.name.toLowerCase(), p]));
  const productBySlug = new Map(q.listProducts().map((p) => [p.slug.toLowerCase(), p]));

  const imported = [];
  const skipped = [];

  for (const [index, record] of records.entries()) {
    const name = valueFor(record, 'name');
    if (!name) {
      skipped.push({ row: index + 2, reason: 'Missing customer name' });
      continue;
    }

    const productRaw = String(valueFor(record, 'product') || '').trim();
    let product = null;
    if (productRaw) {
      product =
        products.get(productRaw.toLowerCase()) ||
        productBySlug.get(productRaw.toLowerCase().replace(/\s+/g, '-')) ||
        null;
      if (!product) {
        // Soft-match on partial product names, e.g. "blackout" -> Blackout Curtains
        const needle = productRaw.toLowerCase();
        product =
          [...products.values()].find(
            (p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase()),
          ) || null;
      }
    }

    const keyword = String(valueFor(record, 'keyword') || '').trim().toLowerCase();
    const source = normalizeSource(valueFor(record, 'source'), Boolean(keyword));

    try {
      const customer = q.createCustomer({
        name,
        email: valueFor(record, 'email'),
        phone: valueFor(record, 'phone'),
        city: valueFor(record, 'city'),
        productId: product ? product.id : null,
        keyword,
        source,
        stage: normalizeStage(valueFor(record, 'stage')),
        budget: normalizeNumber(valueFor(record, 'budget')),
        quoteValue: normalizeNumber(valueFor(record, 'quoteValue')),
        owner: valueFor(record, 'owner'),
        notes: valueFor(record, 'notes'),
        createdAt: normalizeDate(valueFor(record, 'createdAt')),
        landingPage: valueFor(record, 'landingPage'),
        gclid: valueFor(record, 'gclid'),
        device: valueFor(record, 'device') || 'mobile',
        entryLabel: 'Imported from CSV',
      });

      // Enrich the search term with any stats supplied in the file.
      const impressions = normalizeNumber(valueFor(record, 'impressions'));
      const clicks = normalizeNumber(valueFor(record, 'clicks'));
      const position = Number(valueFor(record, 'position')) || 0;
      if (customer.termId && (impressions || clicks || position)) {
        connect()
          .prepare(
            `UPDATE search_terms SET impressions = MAX(impressions, ?), clicks = MAX(clicks, ?),
             position = CASE WHEN ? > 0 THEN ? ELSE position END WHERE id = ?`,
          )
          .run(impressions, clicks, position, position, customer.termId);
      }
      imported.push(customer);
    } catch (error) {
      skipped.push({ row: index + 2, reason: error.message });
    }
  }

  return {
    imported: imported.length,
    skipped: skipped.length,
    details: skipped.slice(0, 25),
    customers: imported.slice(0, 5).map((c) => ({ id: c.id, name: c.name, keyword: c.keyword })),
  };
}

app.post('/api/import', (req, res) => {
  let csvText = '';
  if (typeof req.body === 'string') csvText = req.body;
  else if (req.body && typeof req.body.csv === 'string') csvText = req.body.csv;
  if (!csvText.trim()) {
    return res.status(400).json({ error: 'Send the CSV as text/csv, text/plain, or JSON { "csv": "..." }.' });
  }
  res.json(runImport(csvText));
});

app.get('/api/import/template', (req, res) => {
  const header = [
    'name', 'email', 'phone', 'city', 'product', 'keyword', 'stage', 'source',
    'budget', 'quote_value', 'owner', 'notes', 'created_at', 'landing_page', 'gclid', 'device',
  ];
  const sample = [
    {
      name: 'Ananya Sharma',
      email: 'ananya.sharma@gmail.com',
      phone: '+91 98450 12345',
      city: 'Bengaluru',
      product: 'Motorized Blinds',
      keyword: 'motorized blinds price',
      stage: 'quoted',
      source: 'google_ads',
      budget: '42000',
      quote_value: '44500',
      owner: 'Aisha Menon',
      notes: '4BHK villa in Whitefield, wants app control.',
      created_at: '2026-10-12',
      landing_page: '/collections/motorized-blinds',
      gclid: 'Cj0KCQjw_demo_click_id',
      device: 'mobile',
    },
    {
      name: 'Rahul Nair',
      email: 'rahul.nair@gmail.com',
      phone: '+91 99010 44556',
      city: 'Bengaluru',
      product: 'Blackout Curtains',
      keyword: 'blackout curtains bangalore',
      stage: 'won',
      source: 'google_ads',
      budget: '26000',
      quote_value: '24500',
      owner: 'Rohan Shetty',
      notes: '3BHK, bedrooms only.',
      created_at: '2026-09-28',
      landing_page: '/collections/blackout-curtains',
      gclid: '',
      device: 'desktop',
    },
  ];
  res.type('text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="moviejuke-leads-template.csv"');
  res.send(toCsv(header, sample, header));
});

app.get('/api/export', (req, res) => {
  const stages = String(req.query.stage || '').split(',').map((s) => s.trim()).filter(Boolean);
  const rows = q.listAllCustomers({
    q: req.query.q || '',
    productId: req.query.productId || '',
    stages,
    source: req.query.source || '',
    city: req.query.city || '',
    from: req.query.from || '',
    to: req.query.to || '',
    channel: req.query.channel || '',
    sort: 'newest',
  });
  const headers = [
    'reference', 'name', 'email', 'phone', 'city', 'product', 'keyword', 'stage', 'source',
    'budget', 'quote_value', 'owner', 'landing_page', 'gclid', 'device', 'created_at', 'last_activity_at', 'notes',
  ];
  const mapped = rows.map((r) => ({
    reference: `MJ-${String(r.id).padStart(4, '0')}`,
    name: r.name,
    email: r.email,
    phone: r.phone,
    city: r.city,
    product: r.productName,
    keyword: r.keyword,
    stage: r.stage,
    source: r.source,
    budget: r.budget,
    quote_value: r.quoteValue,
    owner: r.owner,
    landing_page: r.landingPage,
    gclid: r.gclid,
    device: r.device,
    created_at: r.createdAt,
    last_activity_at: r.lastActivityAt,
    notes: r.notes,
  }));
  res.type('text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="moviejuke-customers.csv"');
  res.send(toCsv(headers, mapped, headers));
});

// ---------- demo data controls ----------

app.post('/api/demo/reset', (req, res) => {
  resetData();
  res.json({ ok: true, message: 'Demo data regenerated.' });
});

// ---------- SPA fallback ----------

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[api error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

ensureData();

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Moviejuke Interiors running at http://${HOST}:${PORT}`);
    console.log(`Database: ${DB_PATH}`);
  });
}

module.exports = app;
