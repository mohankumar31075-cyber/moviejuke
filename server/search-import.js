'use strict';

const { connect } = require('./db');
const { parseCsv, toObjects, normalizeHeader } = require('./csv');
const { ensureSearchTerm } = require('./queries');

const START = '2023-01-01';
// 'Till date' is the current day in the studio's time zone, never a fixed 2026 cutoff.
const END = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
const ALIASES = {
  keyword: ['query', 'top_queries', 'search_term', 'search_terms', 'search_query', 'keyword', 'search_keyword'],
  day: ['date', 'day', 'report_date'],
  impressions: ['impressions', 'impr', 'impr_'],
  clicks: ['clicks', 'click'],
  position: ['position', 'average_position', 'avg_position', 'avg_pos', 'avg_position_organic'],
  source: ['source', 'channel', 'network'],
  landingPage: ['landing_page', 'page', 'final_url', 'url'],
};

function field(row, key) {
  for (const alias of ALIASES[key]) {
    if (row[alias] !== undefined && row[alias] !== '') return String(row[alias]).trim();
  }
  return '';
}

function dayFrom(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/) || text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    const iso = `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
  }
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
  }
  return null;
}

function count(value) {
  const text = String(value || '0').replace(/[,\s]/g, '');
  if (!/^\d+(?:\.0+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function position(value) {
  if (!value || value === '--') return 0;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function importSearchReport(csvText, { from = START, to = END, source: defaultSource = "google_organic" } = {}) {
  if (!["google_organic", "google_ads"].includes(defaultSource)) {
    throw Object.assign(new Error("Choose Google Ads or Search Console as the report source."), { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !dayFrom(from) || !dayFrom(to) || from > to) {
    throw Object.assign(new Error('Choose a valid start and end date.'), { status: 400 });
  }
  const d = connect();
  if (d.prepare("SELECT value FROM meta WHERE key = 'data_mode'").get()?.value === 'demo') {
    throw Object.assign(new Error('Replace demo data before importing a real search report, so demo totals cannot be mistaken for real data.'), { status: 409 });
  }
  const lines = parseCsv(csvText);
  // Google Ads CSV downloads may prepend a report title and a date-range line.
  const headerOffset = lines.findIndex((cells) => {
    const names = cells.map(normalizeHeader);
    return ['keyword', 'day', 'impressions', 'clicks'].every((key) =>
      ALIASES[key].some((alias) => names.includes(alias)));
  });
  const { headers, records } = toObjects(headerOffset > 0 ? lines.slice(headerOffset) : lines);
  if (!records.length) throw Object.assign(new Error('No report rows found below the header.'), { status: 400 });
  for (const key of ['keyword', 'day', 'impressions', 'clicks']) {
    if (!ALIASES[key].some((alias) => headers.includes(alias))) {
      throw Object.assign(new Error(`Missing ${key} column. A dated query report needs date, query/search term, impressions and clicks.`), { status: 400 });
    }
  }

  const grouped = new Map();
  const skipped = [];
  let outOfRange = 0;
  for (const [index, record] of records.entries()) {
    const day = dayFrom(field(record, 'day'));
    const keyword = field(record, 'keyword').toLowerCase();
    const impressions = count(field(record, 'impressions'));
    const clicks = count(field(record, 'clicks'));
    const avg = position(field(record, 'position'));
    if (!day || !keyword || impressions === null || clicks === null || avg === null) {
      skipped.push({ row: index + 2 + Math.max(0, headerOffset), reason: 'Invalid date, query, impressions, clicks or position' });
      continue;
    }
    if (day < from || day > to) { outOfRange++; continue; }
    if (/^(other search terms|anonymi[sz]ed queries|total)$/i.test(keyword)) {
      skipped.push({ row: index + 2 + Math.max(0, headerOffset), reason: 'Aggregate/anonymized row has no attributable query' });
      continue;
    }
    const rawSource = field(record, 'source').toLowerCase();
    const source = /^(google_ads|ads|paid|cpc|google ads|search network)$/.test(rawSource)
      ? 'google_ads' : defaultSource;
    const landingPage = field(record, 'landingPage');
    const key = JSON.stringify([day, keyword, source, landingPage]);
    const item = grouped.get(key) || { day, keyword, source, landingPage, impressions: 0, clicks: 0, weightedPosition: 0, weight: 0 };
    item.impressions += impressions;
    item.clicks += clicks;
    if (avg) {
      const weight = impressions || 1;
      item.weightedPosition += avg * weight;
      item.weight += weight;
    }
    grouped.set(key, item);
  }

  // The same dated report can safely be uploaded again. Re-uploading a partial
  // report replaces only its matching day/query/source/page observations.
  const upsert = d.prepare(`INSERT INTO search_observations
    (term_id, day, source, landing_page, impressions, clicks, position) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(term_id, day, source, landing_page) DO UPDATE SET
      impressions=excluded.impressions, clicks=excluded.clicks, position=excluded.position`);
  const refresh = d.prepare(`UPDATE search_terms SET
    impressions=(SELECT SUM(impressions) FROM search_observations WHERE term_id=?),
    clicks=(SELECT SUM(clicks) FROM search_observations WHERE term_id=?),
    position=(SELECT COALESCE(SUM(position * impressions) / NULLIF(SUM(CASE WHEN position > 0 THEN impressions ELSE 0 END),0), 0)
              FROM search_observations WHERE term_id=?),
    first_seen=(SELECT MIN(day) FROM search_observations WHERE term_id=?),
    last_seen=(SELECT MAX(day) FROM search_observations WHERE term_id=?) WHERE id=?`);
  const ids = new Set();
  d.exec('BEGIN');
  try {
    for (const item of grouped.values()) {
      const id = ensureSearchTerm(item.keyword, { source: item.source, landingPage: item.landingPage });
      ids.add(id);
      upsert.run(id, item.day, item.source, item.landingPage, item.impressions, item.clicks,
        item.weight ? item.weightedPosition / item.weight : 0);
    }
    for (const id of ids) refresh.run(id, id, id, id, id, id);
    d.exec('COMMIT');
  } catch (error) {
    d.exec('ROLLBACK');
    throw error;
  }
  return { imported: grouped.size, terms: ids.size, skipped: skipped.length, outOfRange, details: skipped.slice(0, 25), range: { from, to } };
}

module.exports = { importSearchReport, dayFrom, START, END };
