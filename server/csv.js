'use strict';

/**
 * Minimal, dependency-free RFC-4180-ish CSV reader/writer.
 * Handles quoted fields, escaped quotes (""), embedded newlines and CRLF.
 */
function parseCsv(text) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // swallow; \n handles the row break
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function toObjects(rows) {
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map(normalizeHeader);
  const records = rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] === undefined ? '' : String(cells[index]).trim();
    });
    return record;
  });
  return { headers, records };
}

function escapeCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(headers, rows, columns) {
  const head = headers.map(escapeCell).join(',');
  const body = rows.map((row) => columns.map((col) => escapeCell(row[col])).join(','));
  return [head, ...body].join('\n');
}

module.exports = { parseCsv, toObjects, toCsv, normalizeHeader };
