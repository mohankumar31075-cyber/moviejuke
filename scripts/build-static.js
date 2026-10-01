#!/usr/bin/env node
'use strict';

/**
 * Static build for GitHub Pages (or any plain file host).
 *
 *   node scripts/build-static.js            → dist/
 *
 * The Node API cannot run on a static host, so this prerenders everything the
 * catalogue needs and ships a client that resolves the remaining behaviour
 * (search, streams, queue, library) in the browser:
 *
 *   dist/index.html            client, asset paths made relative, static flag set
 *   dist/api/meta.json         themes, providers, facets, players, defaults
 *   dist/api/home.json         hero deck, shelves, stats, live strip
 *   dist/api/catalog.json      every card + search fields (browse/search runs client-side)
 *   dist/api/live.json         34 channels + full 24h schedules
 *   dist/api/titles/<id>.json  full detail payload per title
 *   dist/.nojekyll             keep GitHub Pages from running Jekyll
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

const engine = require('../data/engine');
const { THEMES } = require('../data/catalog');

const VERSION = require('../package.json').version;

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach((entry) => {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  });
}

const write = (rel, data) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  fs.writeFileSync(file, body);
  return Buffer.byteLength(body);
};

/** index.html for a static host: relative assets + the static transport flag. */
function buildIndex() {
  let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  html = html.replace(/href="\/(css\/[^"]+)"/g, 'href="./$1"');
  html = html.replace(/src="\/(js\/[^"]+)"/g, 'src="./$1"');
  html = html.replace(
    '<script type="module" src="./js/app.js"></script>',
    `<script>window.__MJ_STATIC__ = true; window.__MJ_STATIC_BASE__ = './api';</script>
  <script type="module" src="./js/app.js"></script>`,
  );
  html = html.replace('<meta name="theme-color" content="#080a0f">',
    `<meta name="theme-color" content="#080a0f">
<meta name="generator" content="moviejuke static build v${VERSION}">
<meta name="robots" content="index, follow">`);
  return html;
}

function build() {
  rimraf(OUT);
  copyDir(PUBLIC_DIR, OUT);

  const sizes = [];
  const stats = {
    titles: engine.RECORDS.length,
    providers: engine.PROVIDERS.length,
    channels: engine.live().channels.length,
  };

  // ---------------------------------------------------------------- meta
  const meta = {
    name: 'Moviejuke',
    version: `${VERSION}-static`,
    transport: 'static',
    tagline: 'Terminal-grade discovery for everything you watch, now in the browser.',
    themes: THEMES,
    providers: engine.PROVIDERS,
    qualities: ['Auto', ...engine.QUALITIES],
    subtitles: engine.SUBTITLE_LANGS,
    facets: engine.facets(),
    settings: {
      theme: 'Moviejuke',
      accent: '#e11d48',
      defaultQuality: 'Auto',
      player: 'mpv',
      providers: { moviebox: true, fourkhdhub: true, circleftp: true, addons: false },
      bdix: true,
      autoplayNext: true,
      subtitlesDefault: 'English',
      hardwareDecode: true,
      reduceMotion: false,
      density: 'comfortable',
    },
    profiles: [
      { id: 'p1', name: 'Guest One', accent: '#e11d48', pin: false },
      { id: 'p2', name: 'Guest Two', accent: '#0ea5e9', pin: false },
      { id: 'p3', name: 'Kids', accent: '#f59e0b', pin: true },
      { id: 'p4', name: 'Shared', accent: '#22c55e', pin: false },
    ],
    currentProfile: 'p1',
    players: [
      { id: 'mpv', label: 'MPV', note: 'Best seeking, hardware decode, custom headers.' },
      { id: 'vlc', label: 'VLC', note: 'Widest codec support, network caching controls.' },
      { id: 'iina', label: 'IINA', note: 'macOS native MPV front-end.' },
      { id: 'android', label: 'Android intent', note: 'Hands the URL to any installed player.' },
    ],
  };
  sizes.push(['api/meta.json', write('api/meta.json', meta)]);

  // ---------------------------------------------------------------- home
  const home = engine.home('p1');
  sizes.push(['api/home.json', write('api/home.json', home)]);

  // ------------------------------------------------------------- catalog
  // browse/search runs in the browser, so cards carry their searchable fields
  const catalog = engine.RECORDS.map((rec) => ({
    ...engine.card(rec),
    cast: rec.cast,
    director: rec.director,
    addedAt: rec.addedAt,
    runtime: rec.runtime,
  }));
  sizes.push([`api/catalog.json (${catalog.length} cards)`, write('api/catalog.json', catalog)]);

  // ----------------------------------------------------------------- live
  const live = engine.live();
  const liveSlim = {
    categories: live.categories,
    regions: live.regions,
    epgWindow: `${live.epgWindow} · prerendered`,
    playlist: live.playlist,
    channels: live.channels.map((ch) => ({
      id: ch.id,
      number: ch.number,
      name: ch.name,
      category: ch.category,
      region: ch.region,
      accent: ch.accent,
      quality: ch.quality,
      language: ch.language,
      bitrate: ch.bitrate,
      viewers: ch.viewers,
      uptime: ch.uptime,
      stream: ch.stream,
      // schedules are stored as minutes-from-midnight and re-anchored to the
      // viewer's clock on load, so "now" is always accurate in the browser
      schedule: ch.epg.map((slot) => ({ title: slot.title, start: slot.start, length: slot.length, rating: slot.rating })),
    })),
  };
  sizes.push([`api/live.json (${liveSlim.channels.length} channels)`, write('api/live.json', liveSlim)]);

  // --------------------------------------------------------------- titles
  let titleBytes = 0;
  engine.RECORDS.forEach((rec) => {
    const detail = engine.detail(rec.id);
    // progress/favorite are per-visitor and live in localStorage
    delete detail.progress;
    delete detail.favorite;
    titleBytes += write(`api/titles/${rec.id}.json`, detail);
  });
  sizes.push([`api/titles/*.json (${engine.RECORDS.length} payloads)`, titleBytes]);

  // -------------------------------------------------------------- shell
  sizes.push(['index.html', write('index.html', buildIndex())]);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  const total = sizes.reduce((n, [, b]) => n + b, 0);
  console.log(`\nMoviejuke static build → ${path.relative(ROOT, OUT)}/`);
  console.log(`  index    : ${stats.titles} titles · ${stats.channels} live channels · ${stats.providers} providers`);
  sizes.forEach(([label, bytes]) => console.log(`  ${label.padEnd(44)} ${(bytes / 1024).toFixed(1)} KB`));
  console.log(`  ${'total prerendered JSON + html'.padEnd(44)} ${(total / 1024 / 1024).toFixed(2)} MB`);
  console.log('\n  serve it with any static host, e.g.');
  console.log('    npx serve dist        ·  python3 -m http.server -d dist 8080\n');
}

build();
