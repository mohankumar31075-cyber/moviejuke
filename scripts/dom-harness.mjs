#!/usr/bin/env node
/**
 * Moviejuke DOM render harness — optional, needs `jsdom`.
 *
 *   npm i -D jsdom
 *   node server.js --port=4173 &        # or MJ_BASE=http://host:port
 *   node scripts/dom-harness.mjs
 *
 * Boots the real client modules in jsdom, renders every view, drives the play
 * picker and the resolver-failure flow, and reports DOM shape plus runtime
 * errors. The dependency-free API test lives in scripts/smoke.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'public', 'js');
const BASE = process.env.MJ_BASE || `http://127.0.0.1:${process.env.MJ_PORT || 4173}`;
const SCRATCH = path.join(process.env.TMPDIR || '/tmp', 'moviejuke-dom');

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.log('jsdom is not installed — run `npm i -D jsdom` and try again.');
  process.exit(0);
}

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div class="app">
    <header class="topbar" id="topbar"></header>
    <div class="statusbar" id="statusbar"></div>
    <main class="page" id="view"></main>
  </div>
</body></html>`, { url: `${BASE}/`, pretendToBeVisual: true });

const { window } = dom;
global.window = window;
global.document = window.document;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true, writable: true });
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.DocumentFragment = window.DocumentFragment;
global.getComputedStyle = window.getComputedStyle.bind(window);
global.requestAnimationFrame = window.requestAnimationFrame.bind(window);
global.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
global.URLSearchParams = URLSearchParams;
global.location = window.location;
global.CustomEvent = window.CustomEvent;

const realFetch = globalThis.fetch.bind(globalThis);
global.fetch = (input, init) => realFetch(typeof input === 'string' && input.startsWith('/') ? BASE + input : input, init);

const errors = [];
window.addEventListener('error', (e) => errors.push(`window error: ${e.message}`));

// the client is imported from a scratch copy so module caching stays predictable
function copy(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach((entry) => {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copy(s, d);
    else fs.copyFileSync(s, d);
  });
}
copy(CLIENT, SCRATCH);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const nodeCount = (el) => el.querySelectorAll('*').length;
const view = window.document.getElementById('view');

async function renderView(name, mod, ctx) {
  const t0 = Date.now();
  const el = await mod.render({ ...ctx, refresh: () => {} });
  view.replaceChildren(el);
  check(`view:${name}`, nodeCount(view) > 40, `${nodeCount(view)} nodes in ${Date.now() - t0}ms`);
  return el;
}

try {
  const art = await import(`${SCRATCH}/art.js`);
  const one = art.coverArt({ id: 'dune-part-two', title: 'Dune: Part Two', accent: '#e0a35c', kind: 'm', year: 2024 });
  const two = art.coverArt({ id: 'dune-part-two', title: 'Dune: Part Two', accent: '#e0a35c', kind: 'm', year: 2024 });
  check('art: svg data uri', one.startsWith('data:image/svg+xml') && one.length > 2000, `${(one.length / 1024).toFixed(1)} KB`);
  check('art: deterministic', one === two);
  check('art: icon set', art.icon('play').includes('<svg') && art.icon('search').includes('<circle'));

  const api = await import(`${SCRATCH}/api.js`);
  const meta = await api.api.meta();
  check('api: meta payload', meta.themes.length === 9 && meta.providers.length === 4, `${meta.facets.genres.length} genres`);
  api.store.set({ meta, settings: meta.settings, profiles: meta.profiles, profile: 'p1' });
  api.applySettings(meta.settings);

  const ctx = { params: {}, query: new URLSearchParams(), profile: 'p1', settings: meta.settings, meta };
  await renderView('home', await import(`${SCRATCH}/views/home.js`), ctx);
  await renderView('browse', await import(`${SCRATCH}/views/browse.js`), { ...ctx, query: new URLSearchParams('q=the&kind=s') });
  await renderView('title', await import(`${SCRATCH}/views/title.js`), { ...ctx, params: { id: 'severance' }, query: new URLSearchParams('tab=streams') });
  await renderView('live', await import(`${SCRATCH}/views/live.js`), ctx);
  await renderView('downloads', await import(`${SCRATCH}/views/downloads.js`), ctx);
  await renderView('library', await import(`${SCRATCH}/views/library.js`), ctx);
  await renderView('settings', await import(`${SCRATCH}/views/settings.js`), ctx);

  const titleMod = await import(`${SCRATCH}/views/title.js`);
  const eps = await titleMod.render({ ...ctx, params: { id: 'severance' }, query: new URLSearchParams('tab=episodes'), refresh: () => {} });
  check('title: episode rows', eps.querySelectorAll('.episode').length >= 8, `${eps.querySelectorAll('.episode').length} rows`);
  check('title: collection label', eps.textContent.includes('TV Series'));

  await api.api.libraryAction('p1', { action: 'progress', titleId: 'the-bear', position: 600, duration: 2040, season: 1, episode: 2 });
  await api.api.libraryAction('p1', { action: 'favorite', titleId: 'arrival' });
  const libMod = await import(`${SCRATCH}/views/library.js`);
  const historyEl = await libMod.render({ ...ctx, query: new URLSearchParams('tab=history'), refresh: () => {} });
  check('library: history rows', historyEl.querySelectorAll('.card-row').length >= 1);
  const favEl = await libMod.render({ ...ctx, query: new URLSearchParams('tab=favorites'), refresh: () => {} });
  check('library: favorites grid', favEl.querySelectorAll('.grid-cards .card').length >= 1);

  const flows = await import(`${SCRATCH}/flows.js`);
  const detail = await api.api.title('severance', 'p1');
  await flows.playFlow(detail);
  const picker = window.document.querySelector('.overlay');
  check('flow: play picker', !!picker && picker.textContent.includes('Provider'), picker ? `${picker.querySelectorAll('.quality-opt').length} quality rows` : 'no overlay');
  const { closeModal } = await import(`${SCRATCH}/components.js`);
  closeModal();

  await api.api.settings({ bdix: false });
  const silo = await api.api.title('silo', 'p1');
  await flows.resolveAndPlay(silo, { providerId: 'circleftp', quality: '1080p', season: 1, episode: 1 });
  await new Promise((r) => setTimeout(r, 400));
  const failure = window.document.querySelector('.overlay');
  const failureText = failure ? failure.textContent : '';
  check('flow: resolver failure modal', /could not start playback/i.test(failureText) && /CircleFTP unreachable/.test(failureText));
  check('flow: fallback retry offered', /Retry on MovieBox/.test(failureText));
  closeModal();
  await api.api.settings({ bdix: true });

  await import(`${SCRATCH}/app.js`);
  if (window.document.readyState !== 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 900));
  check('chrome: nav', window.document.getElementById('topbar').querySelectorAll('.nav a').length === 6);
  check('chrome: status bar', window.document.getElementById('statusbar').textContent.includes('providers live'));
  check('no runtime errors', errors.length === 0, errors.join(' | ') || 'clean');

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error('harness crashed:', err);
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  process.exit(2);
}
