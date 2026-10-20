'use strict';

const { connect } = require('./db');

const STAGE_ORDER = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost'];
const STAGE_LABELS = {
  new: 'New enquiry',
  contacted: 'Contacted',
  qualified: 'Qualified',
  quoted: 'Quote sent',
  won: 'Won',
  lost: 'Lost',
};

const SORTS = {
  newest: 'c.created_at DESC',
  oldest: 'c.created_at ASC',
  activity: 'c.last_activity_at DESC',
  value: 'c.quote_value DESC, c.budget DESC',
  budget: 'c.budget DESC',
  name: 'c.name ASC',
};

const CUSTOMER_SELECT = `
  SELECT
    c.id, c.name, c.email, c.phone, c.city, c.stage, c.source,
    c.interest, c.property_name AS propertyName, c.pin_code AS pinCode,
    c.budget, c.quote_value AS quoteValue, c.owner, c.gclid,
    c.landing_page AS landingPage, c.device, c.notes,
    c.created_at AS createdAt, c.last_activity_at AS lastActivityAt,
    c.product_id AS productId, c.search_term_id AS termId,
    p.name AS productName, p.category AS productCategory, p.slug AS productSlug,
    s.keyword AS keyword, s.clicks AS termClicks, s.position AS termPosition,
    s.impressions AS termImpressions, s.source AS termSource
  FROM customers c
  LEFT JOIN products p ON p.id = c.product_id
  LEFT JOIN search_terms s ON s.id = c.search_term_id
`;

function db() {
  return connect();
}

function listProducts() {
  return db()
    .prepare(
      `SELECT p.id, p.slug, p.name, p.category, p.price_from AS priceFrom, p.avg_ticket AS avgTicket,
              p.description,
              (SELECT COUNT(*) FROM customers c WHERE c.product_id = p.id) AS customers,
              (SELECT COUNT(*) FROM search_terms s WHERE s.product_id = p.id) AS terms
       FROM products p ORDER BY customers DESC, p.name ASC`,
    )
    .all();
}

function stageCounts() {
  const rows = db()
    .prepare('SELECT stage, COUNT(*) AS n, COALESCE(SUM(quote_value), 0) AS value FROM customers GROUP BY stage')
    .all();
  return rows;
}

function getFilterOptions() {
  const d = db();
  const products = listProducts().map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    slug: p.slug,
    customers: p.customers,
  }));
  const cities = d
    .prepare(
      `SELECT city, COUNT(*) AS n FROM customers WHERE city IS NOT NULL AND city <> ''
       GROUP BY city ORDER BY n DESC`,
    )
    .all()
    .map((r) => ({ value: r.city, count: Number(r.n) }));
  const sources = d
    .prepare(
      `SELECT source, COUNT(*) AS n FROM customers GROUP BY source ORDER BY n DESC`,
    )
    .all()
    .map((r) => ({ value: r.source, count: Number(r.n) }));
  const stages = STAGE_ORDER.map((stage) => ({
    value: stage,
    label: STAGE_LABELS[stage],
    count: Number(
      d.prepare('SELECT COUNT(*) AS n FROM customers WHERE stage = ?').get(stage).n,
    ),
  }));
  const meta = d.prepare("SELECT value FROM meta WHERE key = 'seeded_at'").get();
  const mode = d.prepare("SELECT value FROM meta WHERE key = 'data_mode'").get();
  const coverage = d.prepare('SELECT COUNT(*) AS rows, MIN(day) AS first, MAX(day) AS last FROM search_observations').get();
  return {
    products,
    cities,
    sources,
    stages,
    termCount: Number(d.prepare('SELECT COUNT(*) AS n FROM search_terms').get().n),
    customerCount: Number(d.prepare('SELECT COUNT(*) AS n FROM customers').get().n),
    seededAt: meta ? meta.value : null,
    dataMode: mode?.value || 'demo',
    searchCoverage: { rows: coverage.rows, first: coverage.first, last: coverage.last },
  };
}

function buildCustomerWhere(filters) {
  const clauses = [];
  const params = [];

  if (filters.q) {
    const like = `%${filters.q.toLowerCase()}%`;
    clauses.push(`(
      LOWER(c.name) LIKE ? OR LOWER(COALESCE(c.email, '')) LIKE ? OR
      LOWER(COALESCE(c.phone, '')) LIKE ? OR LOWER(COALESCE(c.city, '')) LIKE ? OR
      LOWER(COALESCE(s.keyword, '')) LIKE ? OR LOWER(COALESCE(p.name, '')) LIKE ? OR
      LOWER(COALESCE(c.interest, '')) LIKE ? OR LOWER(COALESCE(c.property_name, '')) LIKE ? OR
      LOWER(COALESCE(c.pin_code, '')) LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like, like);
  }
  if (filters.productId) {
    clauses.push('c.product_id = ?');
    params.push(Number(filters.productId));
  }
  if (filters.termId) {
    clauses.push('c.search_term_id = ?');
    params.push(Number(filters.termId));
  }
  if (filters.stages && filters.stages.length) {
    clauses.push(`c.stage IN (${filters.stages.map(() => '?').join(', ')})`);
    params.push(...filters.stages);
  }
  if (filters.source) {
    clauses.push('c.source = ?');
    params.push(filters.source);
  }
  if (filters.city) {
    clauses.push('c.city = ?');
    params.push(filters.city);
  }
  if (filters.from) {
    clauses.push('c.created_at >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push("c.created_at < date(?, '+1 day')");
    params.push(filters.to);
  }
  if (filters.minBudget) {
    clauses.push('c.budget >= ?');
    params.push(Number(filters.minBudget));
  }
  if (filters.channel === 'search') {
    clauses.push('c.search_term_id IS NOT NULL');
  } else if (filters.channel === 'direct') {
    clauses.push('c.search_term_id IS NULL');
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function listCustomers(filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(filters.pageSize) || 12));
  const { where, params } = buildCustomerWhere(filters);
  const sort = SORTS[filters.sort] || SORTS.newest;

  const total = Number(
    db()
      .prepare(`SELECT COUNT(*) AS n FROM customers c
                LEFT JOIN products p ON p.id = c.product_id
                LEFT JOIN search_terms s ON s.id = c.search_term_id ${where}`)
      .get(...params).n,
  );

  const rows = db()
    .prepare(`${CUSTOMER_SELECT} ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { rows, total, page: Math.min(page, pageCount), pageSize, pageCount };
}

function listAllCustomers(filters = {}) {
  const { where, params } = buildCustomerWhere(filters);
  const sort = SORTS[filters.sort] || SORTS.newest;
  return db().prepare(`${CUSTOMER_SELECT} ${where} ORDER BY ${sort}`).all(...params);
}

function getCustomer(id) {
  const customer = db().prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(Number(id));
  if (!customer) return null;
  const events = db()
    .prepare('SELECT id, type, label, occurred_at AS occurredAt FROM events WHERE customer_id = ? ORDER BY occurred_at ASC, id ASC')
    .all(Number(id));
  return { ...customer, events };
}

function addEvent(customerId, type, label, occurredAt) {
  db()
    .prepare('INSERT INTO events (customer_id, type, label, occurred_at) VALUES (?, ?, ?, ?)')
    .run(Number(customerId), type, label, occurredAt || new Date().toISOString());
}

function ensureSearchTerm(keyword, options = {}) {
  const d = db();
  const clean = String(keyword || '').trim().toLowerCase();
  if (!clean) return null;
  const existing = d.prepare('SELECT id FROM search_terms WHERE LOWER(keyword) = ?').get(clean);
  if (existing) return Number(existing.id);

  let productId = options.productId ? Number(options.productId) : null;
  let landingPage = options.landingPage || null;
  if (productId) {
    const product = d.prepare('SELECT slug, category FROM products WHERE id = ?').get(productId);
    if (product && !landingPage) {
      landingPage = product.category === 'Interiors'
        ? `/interiors/${product.slug}`
        : product.category === 'Upholstery'
          ? `/services/${product.slug}`
          : `/collections/${product.slug}`;
    }
  } else {
    productId = null;
  }
  const now = new Date().toISOString();
  const info = d
    .prepare(
      `INSERT INTO search_terms (keyword, product_id, source, impressions, clicks, position, landing_page, first_seen, last_seen)
       VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?)`,
    )
    .run(clean, productId, options.source || 'google_organic', landingPage, now, now);
  return Number(info.lastInsertRowid);
}

function createCustomer(payload) {
  const d = db();
  const now = new Date().toISOString();
  const createdAt = payload.createdAt || now;
  let termId = payload.termId ? Number(payload.termId) : null;
  if (!termId && payload.keyword) {
    termId = ensureSearchTerm(payload.keyword, {
      productId: payload.productId,
      source: payload.source,
      landingPage: payload.landingPage,
    });
  }
  const stage = STAGE_ORDER.includes(payload.stage) ? payload.stage : 'new';
  const info = d
    .prepare(
      `INSERT INTO customers
        (name, email, phone, city, interest, property_name, pin_code,
         product_id, search_term_id, source, stage, budget, quote_value,
         owner, gclid, landing_page, device, notes, created_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      String(payload.name || 'Unnamed enquiry').trim(),
      payload.email || null,
      payload.phone || null,
      payload.city || null,
      String(payload.interest || '').trim().slice(0, 200) || null,
      String(payload.propertyName || '').trim().slice(0, 200) || null,
      String(payload.pinCode || '').trim().slice(0, 20) || null,
      payload.productId ? Number(payload.productId) : null,
      termId,
      payload.source || (termId ? 'google_organic' : 'direct'),
      stage,
      Number(payload.budget) || 0,
      Number(payload.quoteValue) || 0,
      payload.owner || null,
      payload.gclid || null,
      payload.landingPage || null,
      payload.device || 'mobile',
      payload.notes || null,
      createdAt,
      createdAt,
    );
  const id = Number(info.lastInsertRowid);

  if (payload.keyword) {
    addEvent(id, 'search', `Searched “${String(payload.keyword).trim()}” on Google`, createdAt);
  }
  addEvent(
    id,
    'form',
    payload.entryLabel || 'Enquiry form submitted',
    createdAt,
  );
  if (payload.notes) addEvent(id, 'note', 'Note added by team', createdAt);

  return getCustomer(id);
}

const STAGE_EVENT_LABELS = {
  new: 'Moved back to new',
  contacted: 'Marked as contacted',
  qualified: 'Qualified — requirements confirmed',
  quoted: 'Quotation shared with customer',
  won: 'Marked won — booking confirmed',
  lost: 'Marked lost',
};

function updateCustomer(id, patch) {
  const d = db();
  const current = d.prepare('SELECT * FROM customers WHERE id = ?').get(Number(id));
  if (!current) return null;

  const fields = [];
  const params = [];
  const allowed = ['name', 'email', 'phone', 'city', 'interest', 'source', 'owner', 'notes', 'stage'];
  if (patch.propertyName !== undefined) { fields.push('property_name = ?'); params.push(patch.propertyName); }
  if (patch.pinCode !== undefined) { fields.push('pin_code = ?'); params.push(patch.pinCode); }
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(patch[key]);
    }
  }
  if (patch.budget !== undefined) {
    fields.push('budget = ?');
    params.push(Number(patch.budget) || 0);
  }
  if (patch.quoteValue !== undefined) {
    fields.push('quote_value = ?');
    params.push(Number(patch.quoteValue) || 0);
  }
  if (patch.productId !== undefined) {
    fields.push('product_id = ?');
    params.push(patch.productId ? Number(patch.productId) : null);
  }

  const now = new Date().toISOString();
  fields.push('last_activity_at = ?');
  params.push(now);

  d.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...params, Number(id));

  if (patch.stage && patch.stage !== current.stage) {
    addEvent(
      Number(id),
      'stage',
      STAGE_EVENT_LABELS[patch.stage] || `Stage changed to ${patch.stage}`,
      now,
    );
  }
  if (patch.noteEvent) {
    addEvent(Number(id), 'note', patch.noteEvent, now);
  }
  return getCustomer(id);
}

function listSearchTerms(filters = {}) {
  const clauses = [];
  const params = [];
  const sourceParams = filters.source ? Array(6).fill(filters.source) : [];
  const leadSource = filters.source ? ' AND c.source = ?' : '';
  if (filters.q) {
    clauses.push('(LOWER(s.keyword) LIKE ? OR LOWER(COALESCE(p.name, \'\')) LIKE ?)');
    const like = `%${filters.q.toLowerCase()}%`;
    params.push(like, like);
  }
  if (filters.productId) {
    clauses.push('s.product_id = ?');
    params.push(Number(filters.productId));
  }
  if (filters.source) {
    clauses.push('(obs.term_id IS NOT NULL OR (s.source = ? AND NOT EXISTS (SELECT 1 FROM search_observations x WHERE x.term_id=s.id)))');
    params.push(filters.source);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db()
    .prepare(
      `SELECT s.id, s.keyword, ${filters.source ? '? AS source' : 's.source'},
              CASE WHEN EXISTS(SELECT 1 FROM search_observations x WHERE x.term_id=s.id) THEN COALESCE(obs.impressions,0) ELSE s.impressions END AS impressions,
              CASE WHEN EXISTS(SELECT 1 FROM search_observations x WHERE x.term_id=s.id) THEN COALESCE(obs.clicks,0) ELSE s.clicks END AS clicks,
              CASE WHEN EXISTS(SELECT 1 FROM search_observations x WHERE x.term_id=s.id) THEN COALESCE(obs.position,0) ELSE s.position END AS position,
              s.landing_page AS landingPage, s.first_seen AS firstSeen, s.last_seen AS lastSeen,
              p.id AS productId, p.name AS productName, p.category AS productCategory,
              (SELECT COUNT(*) FROM customers c WHERE c.search_term_id = s.id${leadSource}) AS leads,
              (SELECT COUNT(*) FROM customers c WHERE c.search_term_id = s.id AND c.stage IN ('qualified','quoted','won')${leadSource}) AS qualified,
              (SELECT COALESCE(SUM(c.quote_value), 0) FROM customers c WHERE c.search_term_id = s.id AND c.stage IN ('quoted','won')${leadSource}) AS pipeline,
              (SELECT COALESCE(SUM(c.quote_value), 0) FROM customers c WHERE c.search_term_id = s.id AND c.stage = 'won'${leadSource}) AS revenue
       FROM search_terms s
       LEFT JOIN products p ON p.id = s.product_id
       LEFT JOIN (SELECT term_id, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
          COALESCE(SUM(position * impressions) / NULLIF(SUM(CASE WHEN position > 0 THEN impressions ELSE 0 END),0),0) AS position
          FROM search_observations ${filters.source ? 'WHERE source = ?' : ''} GROUP BY term_id) obs ON obs.term_id=s.id
       ${where}`,
    )
    .all(...sourceParams, ...params)
    .map((row) => {
      const clicks = Number(row.clicks);
      const leads = Number(row.leads);
      return {
        ...row,
        impressions: Number(row.impressions),
        clicks,
        leads,
        qualified: Number(row.qualified),
        pipeline: Number(row.pipeline),
        revenue: Number(row.revenue),
        ctr: Number(row.impressions) ? (clicks / Number(row.impressions)) * 100 : 0,
        conversion: clicks ? (leads / clicks) * 100 : 0,
      };
    });

  const sorters = {
    leads: (a, b) => b.leads - a.leads || b.clicks - a.clicks,
    clicks: (a, b) => b.clicks - a.clicks,
    impressions: (a, b) => b.impressions - a.impressions,
    conversion: (a, b) => b.conversion - a.conversion,
    position: (a, b) => a.position - b.position,
    pipeline: (a, b) => b.pipeline - a.pipeline,
    ctr: (a, b) => b.ctr - a.ctr,
  };
  rows.sort(sorters[filters.sort] || sorters.leads);

  const totals = rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      leads: acc.leads + row.leads,
      qualified: acc.qualified + row.qualified,
      pipeline: acc.pipeline + row.pipeline,
      revenue: acc.revenue + row.revenue,
    }),
    { impressions: 0, clicks: 0, leads: 0, qualified: 0, pipeline: 0, revenue: 0 },
  );
  return { rows, totals, count: rows.length };
}

function getOverview({ days = 30 } = {}) {
  const d = db();
  const now = new Date();
  const windowStart = new Date(now.getTime() - days * 86400000).toISOString();
  const prevStart = new Date(now.getTime() - days * 2 * 86400000).toISOString();

  const totals = d
    .prepare(
      `SELECT
         COUNT(*) AS customers,
         SUM(CASE WHEN search_term_id IS NOT NULL THEN 1 ELSE 0 END) AS searchCustomers,
         SUM(CASE WHEN stage IN ('qualified','quoted','won') THEN 1 ELSE 0 END) AS qualified,
         SUM(CASE WHEN stage IN ('quoted','won') THEN 1 ELSE 0 END) AS quoted,
         SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) AS won,
         SUM(CASE WHEN stage = 'lost' THEN 1 ELSE 0 END) AS lost,
         SUM(CASE WHEN stage = 'new' THEN 1 ELSE 0 END) AS newCount,
         COALESCE(SUM(CASE WHEN stage IN ('quoted','won') THEN quote_value ELSE 0 END), 0) AS pipeline,
         COALESCE(SUM(CASE WHEN stage = 'won' THEN quote_value ELSE 0 END), 0) AS revenue
       FROM customers`,
    )
    .get();

  const currentWindow = d
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN stage IN ('quoted','won') THEN quote_value ELSE 0 END), 0) AS pipeline
       FROM customers WHERE created_at >= ?`,
    )
    .get(windowStart);
  const previousWindow = d
    .prepare('SELECT COUNT(*) AS n FROM customers WHERE created_at >= ? AND created_at < ?')
    .get(prevStart, windowStart);

  const statusCounts = stageCounts();
  const funnelRow = d
    .prepare('SELECT COALESCE(SUM(impressions), 0) AS impressions, COALESCE(SUM(clicks), 0) AS clicks FROM search_terms')
    .get();

  const dailyRows = d
    .prepare(
      `SELECT date(created_at) AS day,
              COUNT(*) AS customers,
              SUM(CASE WHEN search_term_id IS NOT NULL THEN 1 ELSE 0 END) AS searchCustomers,
              SUM(CASE WHEN stage IN ('qualified','quoted','won') THEN 1 ELSE 0 END) AS qualified,
              COALESCE(SUM(CASE WHEN stage IN ('quoted','won') THEN quote_value ELSE 0 END), 0) AS pipeline
       FROM customers WHERE created_at >= ? GROUP BY day ORDER BY day ASC`,
    )
    .all(new Date(now.getTime() - (days - 1) * 86400000).toISOString());
  const dailyMap = new Map(dailyRows.map((r) => [r.day, r]));
  const daily = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    const row = dailyMap.get(day);
    daily.push({
      date: day,
      customers: row ? Number(row.customers) : 0,
      searchCustomers: row ? Number(row.searchCustomers) : 0,
      qualified: row ? Number(row.qualified) : 0,
      pipeline: row ? Number(row.pipeline) : 0,
    });
  }

  const topProducts = d
    .prepare(
      `SELECT p.id, p.name, p.category, p.slug,
              COUNT(c.id) AS customers,
              COALESCE(SUM(CASE WHEN c.stage IN ('quoted','won') THEN c.quote_value ELSE 0 END), 0) AS pipeline,
              (SELECT COALESCE(SUM(s.clicks), 0) FROM search_terms s WHERE s.product_id = p.id) AS clicks
       FROM products p
       LEFT JOIN customers c ON c.product_id = p.id
       GROUP BY p.id ORDER BY customers DESC LIMIT 6`,
    )
    .all()
    .map((r) => ({ ...r, customers: Number(r.customers), pipeline: Number(r.pipeline), clicks: Number(r.clicks) }));

  const topTerms = listSearchTerms({ sort: 'leads' }).rows.slice(0, 6);

  const recent = d
    .prepare(`${CUSTOMER_SELECT} ORDER BY c.created_at DESC LIMIT 6`)
    .all();

  const attentionRows = d
    .prepare(
      `${CUSTOMER_SELECT}
       WHERE c.stage = 'new' AND c.created_at <= ?
       ORDER BY c.created_at ASC LIMIT 5`,
    )
    .all(new Date(now.getTime() - 36 * 3600000).toISOString());

  const cities = d
    .prepare(
      `SELECT city, COUNT(*) AS customers, COALESCE(SUM(CASE WHEN stage IN ('quoted','won') THEN quote_value ELSE 0 END), 0) AS pipeline
       FROM customers WHERE city IS NOT NULL GROUP BY city ORDER BY customers DESC LIMIT 6`,
    )
    .all()
    .map((r) => ({ ...r, customers: Number(r.customers), pipeline: Number(r.pipeline) }));

  const delta = previousWindow.n
    ? ((Number(currentWindow.n) - Number(previousWindow.n)) / Number(previousWindow.n)) * 100
    : 0;

  const customers = Number(totals.customers) || 0;
  const qualified = Number(totals.qualified) || 0;

  return {
    range: { days, from: windowStart, to: now.toISOString() },
    kpis: {
      customers,
      newCustomers: Number(currentWindow.n),
      customersDelta: delta,
      searchCustomers: Number(totals.searchCustomers) || 0,
      qualified,
      qualifiedRate: customers ? (qualified / customers) * 100 : 0,
      won: Number(totals.won) || 0,
      lost: Number(totals.lost) || 0,
      newCount: Number(totals.newCount) || 0,
      pipeline: Number(totals.pipeline),
      newPipeline: Number(currentWindow.pipeline),
      revenue: Number(totals.revenue),
      avgDeal: Number(totals.won) ? Number(totals.revenue) / Number(totals.won) : 0,
      impressions: Number(funnelRow.impressions),
      clicks: Number(funnelRow.clicks),
    },
    funnel: [
      { key: 'impressions', label: 'Google impressions', value: Number(funnelRow.impressions) },
      { key: 'clicks', label: 'Clicks to site', value: Number(funnelRow.clicks) },
      { key: 'enquiries', label: 'Enquiries captured', value: Number(totals.searchCustomers) || 0 },
      { key: 'qualified', label: 'Qualified by team', value: qualified },
      { key: 'won', label: 'Bookings won', value: Number(totals.won) || 0 },
    ],
    stages: STAGE_ORDER.map((stage) => {
      const row = statusCounts.find((s) => s.stage === stage);
      return {
        stage,
        label: STAGE_LABELS[stage],
        count: row ? Number(row.n) : 0,
        value: row ? Number(row.value) : 0,
      };
    }),
    daily,
    topProducts,
    topTerms,
    recent,
    attention: attentionRows,
    cities,
  };
}

module.exports = {
  STAGE_ORDER,
  STAGE_LABELS,
  listProducts,
  getFilterOptions,
  listCustomers,
  listAllCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  addEvent,
  ensureSearchTerm,
  listSearchTerms,
  getOverview,
  stageCounts,
};
