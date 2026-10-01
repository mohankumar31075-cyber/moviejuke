#!/usr/bin/env node
'use strict';

/**
 * Moviejuke smoke test — zero dependencies.
 *
 * Boots the real server on a scratch port with an accelerated download
 * simulation, then exercises every API surface and the queue lifecycle.
 *
 *   node scripts/smoke.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = Number(process.env.MJ_TEST_PORT || 4899);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, '..');
const STATE = path.join(os.tmpdir(), `moviejuke-smoke-${process.pid}.json`);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  \u2713 ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  \u2717 ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(pathname, opts = {}) {
  const res = await fetch(BASE + pathname, {
    headers: { 'content-type': 'application/json' },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await api('/api/health');
      if (res.status === 200) return true;
    } catch { /* not up yet */ }
    await sleep(150);
  }
  return false;
}

async function run() {
  console.log(`\nMoviejuke smoke test → ${BASE}\n`);

  // ------------------------------------------------------------ static + meta
  console.log('surface');
  const index = await fetch(BASE + '/');
  check('index.html served', index.status === 200 && (await index.text()).includes('Moviejuke'));
  for (const asset of ['/css/app.css', '/js/app.js', '/js/art.js', '/js/components.js', '/js/views/home.js', '/js/views/title.js']) {
    const res = await fetch(BASE + asset);
    const body = await res.text();
    check(`asset ${asset}`, res.status === 200 && body.length > 500, `${(body.length / 1024).toFixed(1)} KB`);
  }
  const missing = await fetch(BASE + '/js/nope.js');
  check('missing asset → 404', missing.status === 404);

  const health = await api('/api/health');
  check('health', health.body.ok === true && health.body.version, `v${health.body.version}`);

  const meta = await api('/api/meta');
  check('meta: providers + themes', meta.body.providers.length === 4 && meta.body.themes.length === 9);
  check('meta: facets', meta.body.facets.genres.length > 15 && meta.body.facets.years.length > 8,
    `${meta.body.facets.genres.length} genres / ${meta.body.facets.languages.length} languages`);

  // ----------------------------------------------------------------- catalogue
  console.log('\ncatalogue');
  const home = await api('/api/home?profile=p1');
  check('home: hero + rows', home.body.hero.length === 5 && home.body.rows.length >= 6, `${home.body.rows.length} shelves`);
  check('home: stats', home.body.stats.titles > 50 && home.body.stats.channels > 20,
    `${home.body.stats.titles} titles · ${home.body.stats.episodes} episodes · ${home.body.stats.channels} channels`);
  check('home: live strip', home.body.liveNow.length === 8);

  const filtered = await api('/api/browse?kind=a&sort=rating&perPage=5');
  check('browse: kind filter + sort', filtered.body.items.length === 5 && filtered.body.items[0].kind === 'a',
    filtered.body.items.map((i) => i.title).slice(0, 2).join(', '));
  const search = await api('/api/browse?q=nolan');
  check('browse: director search', search.body.items.some((i) => i.title === 'Oppenheimer'), `${search.body.total} hit(s) for “nolan”`);
  const castSearch = await api('/api/browse?q=zendaya');
  check('browse: cast search', castSearch.body.total >= 2, `${castSearch.body.total} hits for “zendaya”`);
  const paged = await api('/api/browse?perPage=10&page=2');
  check('browse: pagination', paged.body.page === 2 && paged.body.items.length === 10, `page ${paged.body.page}/${paged.body.pages}`);
  const none = await api('/api/browse?q=zzzzz');
  check('browse: empty state', none.body.total === 0 && none.body.items.length === 0);

  const movie = await api('/api/title/dune-part-two');
  check('title: movie detail', movie.body.kind === 'm' && movie.body.releases.length > 6 && movie.body.seasonsDetail.length === 0,
    `${movie.body.releases.length} releases`);
  check('title: collection label', movie.body.collection === 'Movies');
  const series = await api('/api/title/severance');
  const eps = series.body.seasonsDetail.reduce((n, b) => n + b.count, 0);
  check('title: series seasons', series.body.seasons === 2 && eps >= 8, `${eps} episodes across ${series.body.seasonsDetail.length} seasons`);
  check('title: subtitles', series.body.subtitles.length >= 3, series.body.subtitles.map((s) => s.lang).join(', '));
  check('title: similar', series.body.similar.length === 8);
  const notFound = await api('/api/title/does-not-exist');
  check('title: 404', notFound.status === 404);

  // ------------------------------------------------------------------ resolver
  console.log('\nresolver');
  const ok = await api('/api/stream?title=severance&provider=moviebox&quality=1080p&season=1&episode=1');
  check('stream: resolves', ok.status === 200 && ok.body.ok && ok.body.quality === '1080p',
    `${ok.body.size} · ${ok.body.audio} · ${ok.body.delivery}`);
  check('stream: transport contract', ok.body.url.includes('#mj-') && !!ok.body.headers.Referer && ok.body.commands.length === 4);
  check('stream: player commands', ok.body.commands.map((c) => c.label).join('/') === 'MPV/VLC/IINA/Android intent');
  check('stream: subtitles attached', ok.body.subtitles.length >= 3);

  const auto = await api('/api/stream?title=the-bear&provider=moviebox&quality=Auto&season=2&episode=3');
  check('stream: auto quality', auto.status === 200 && auto.body.ok);

  const disabled = await api('/api/settings', { method: 'POST', body: { providers: { addons: false } } });
  check('settings: provider toggle persists', disabled.body.settings.providers.addons === false);
  const blocked = await api('/api/stream?title=silo&provider=addons&quality=1080p');
  check('stream: disabled provider blocked', blocked.status === 409 && /disabled/i.test(blocked.body.error), blocked.body.error);
  await api('/api/settings', { method: 'POST', body: { providers: { addons: true } } });

  const bdixOff = await api('/api/settings', { method: 'POST', body: { bdix: false } });
  check('settings: bdix toggle', bdixOff.body.settings.bdix === false);
  const noBdix = await api('/api/stream?title=silo&provider=circleftp&quality=1080p');
  check('stream: BDIX gating', noBdix.status === 409 && /BDIX/.test(noBdix.body.error), noBdix.body.error);
  const alternatives = noBdix.body.alternatives || [];
  check('stream: failure payload offers fallbacks', alternatives.some((a) => a.id === 'moviebox' && a.available));
  await api('/api/settings', { method: 'POST', body: { bdix: true } });
  const withBdix = await api('/api/stream?title=silo&provider=circleftp&quality=1080p');
  check('stream: BDIX restored', withBdix.status === 200 && withBdix.body.ok);

  // ------------------------------------------------------------------ live tv
  console.log('\nlive tv');
  const live = await api('/api/live');
  const ch = live.body.channels[0];
  check('live: channel grid', live.body.channels.length === 34 && live.body.categories.length > 5);
  check('live: EPG populated', ch.epg.length > 10 && ch.now.title && ch.next.title,
    `${ch.name}: ${ch.now.startLabel} ${ch.now.title} → ${ch.next.title}`);
  check('live: schedule covers 24h', ch.epg.reduce((n, s) => n + s.length, 0) >= 1380);
  check('live: M3U playlist', live.body.playlist.startsWith('#EXTM3U') && live.body.playlist.includes('index.m3u8'));
  check('live: progress sane', ch.progress >= 0 && ch.progress <= 100);

  // ---------------------------------------------------------------- diagnostics
  console.log('\ndiagnostics');
  const speed = await api('/api/speedtest');
  check('speedtest: four mirrors', speed.body.results.length === 4 && speed.body.results.every((r) => r.latencyMs > 0));
  const changelog = await api('/api/changelog');
  check('changelog: entries', changelog.body.entries.length >= 2 && changelog.body.entries[0].version === 'v1.0.0');

  // ------------------------------------------------------------------ library
  console.log('\nlibrary');
  await api('/api/library?profile=p1', { method: 'POST', body: { action: 'favorite', titleId: 'arrival' } });
  await api('/api/library?profile=p1', { method: 'POST', body: { action: 'progress', titleId: 'arrival', position: 900, duration: 6960, season: 0, episode: 0 } });
  const lib = await api('/api/library?profile=p1');
  check('library: favorite stored', lib.body.favorites.some((f) => f.id === 'arrival'));
  check('library: resume stored', lib.body.resume.some((r) => r.titleId === 'arrival' && r.position === 900));
  await api('/api/library?profile=p2', { method: 'POST', body: { action: 'favorite', titleId: 'dark' } });
  const lib2 = await api('/api/library?profile=p2');
  const lib1 = await api('/api/library?profile=p1');
  check('library: profiles isolated',
    lib2.body.favorites.some((f) => f.id === 'dark') && !lib1.body.favorites.some((f) => f.id === 'dark'));
  await api('/api/library?profile=p2', { method: 'POST', body: { action: 'clear-favorites' } });
  const cleared = await api('/api/library?profile=p2');
  check('library: clear favorites', cleared.body.favorites.length === 0);
  const launch = await api('/api/stats', { method: 'POST', body: { action: 'launch' } });
  check('stats: launch counter', launch.body.stats.launches >= 1);

  // ---------------------------------------------------------------- downloads
  console.log('\ndownload queue');
  const queued = await api('/api/downloads', { method: 'POST', body: { titleId: 'the-bear', provider: 'moviebox', quality: '1080p', season: 1, episode: 1, allSeasons: true } });
  check('queue: enqueue season', queued.status === 201 && queued.body.items.length >= 8, `${queued.body.items.length} items`);
  const first = queued.body.items[0];
  check('queue: item shape', first.state === 'downloading' && first.sizeGb > 0.1 && first.segments >= 1,
    `${first.label} ${first.sizeGb} GB · ${first.segments} segments`);

  await sleep(1600);
  const progress = await api('/api/downloads');
  const item = progress.body.active.find((d) => d.id === first.id);
  check('queue: simulated transfer advances', item && item.downloadedGb > 0 && item.speedMbps > 0,
    `${item.downloadedGb.toFixed(2)} GB at ${item.speedMbps} Mb/s · eta ${item.etaSec}s`);

  const paused = await api('/api/downloads', { method: 'PATCH', body: { id: first.id, action: 'pause' } });
  check('queue: pause', paused.body.item.state === 'paused');
  await sleep(1200);
  const stillPaused = (await api('/api/downloads')).body.active.find((d) => d.id === first.id);
  check('queue: paused transfer is frozen', stillPaused.state === 'paused' && stillPaused.downloadedGb === item.downloadedGb);
  const resumed = await api('/api/downloads', { method: 'PATCH', body: { id: first.id, action: 'resume' } });
  check('queue: resume', resumed.body.item.state === 'downloading');
  const boosted = await api('/api/downloads', { method: 'PATCH', body: { id: first.id, action: 'boost' } });
  check('queue: boost doubles segments', boosted.body.item.segments === first.segments * 2, `${boosted.body.item.segments} segments`);

  const remainder = queued.body.items.slice(1, 4);
  await Promise.all(remainder.map((d) => api('/api/downloads', { method: 'DELETE', body: { id: d.id } })));
  const afterDelete = await api('/api/downloads');
  check('queue: delete', !afterDelete.body.active.some((d) => d.id === remainder[0].id));

  // drain: everything is accelerated and small, so completion arrives quickly
  let completed = null;
  for (let i = 0; i < 90 && !completed; i += 1) {
    await sleep(500);
    const snap = await api('/api/downloads');
    completed = snap.body.history.find((d) => d.id === first.id);
  }
  check('queue: completes', !!completed, completed ? `${completed.downloadedGb} GB in ${((completed.completedAt - completed.addedAt) / 1000).toFixed(1)}s` : 'never finished');
  check('queue: history recorded', (await api('/api/downloads')).body.history.some((d) => d.id === first.id));
  await sleep(6000);
  check('queue: completed items retire from active', !(await api('/api/downloads')).body.active.some((d) => d.id === first.id));

  // with BDIX switched off the requested mirror cannot resolve, so the queue
  // must transparently fall through to the next ready provider.
  await api('/api/settings', { method: 'POST', body: { bdix: false } });
  const fellBack = await api('/api/downloads', { method: 'POST', body: { titleId: 'silo', provider: 'circleftp', quality: '1080p', season: 1, episode: 1 } });
  const fbItem = fellBack.body.items[0];
  check('queue: fallback provider on failure',
    fbItem.state === 'downloading' && !!fbItem.fallbackFrom && fbItem.provider !== 'CircleFTP',
    fbItem.fallbackFrom ? `fell back from ${fbItem.fallbackFrom.providerId} (${fbItem.fallbackFrom.error}) → ${fbItem.provider}` : 'no fallback');
  await api('/api/settings', { method: 'POST', body: { bdix: true } });

  const stats = await api('/api/stats');
  check('stats: bytes tracked', stats.body.bytesPulled > 0 && stats.body.resolutions > 0,
    `${stats.body.bytesPulled.toFixed(2)} GB pulled · ${stats.body.resolutions} resolutions`);

  console.log(`\n${passed}/${passed + failed} checks passed`);
  if (failed) console.log(`failed: ${failures.join(', ')}`);
  return failed === 0;
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js'), `--port=${PORT}`], {
    cwd: ROOT,
    env: { ...process.env, MJ_STATE_FILE: STATE, MJ_TICK_MS: '250', MJ_SIM_SPEED: '45' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  server.stdout.on('data', (d) => logs.push(String(d)));
  server.stderr.on('data', (d) => logs.push(String(d)));

  let ok = false;
  try {
    const up = await waitForServer();
    if (!up) throw new Error(`server did not start\n${logs.join('')}`);
    ok = await run();
  } catch (err) {
    console.error('\nsmoke test crashed:', err.message);
    console.error(logs.join(''));
  } finally {
    server.kill('SIGKILL');
    try { fs.unlinkSync(STATE); } catch { /* ignore */ }
  }
  process.exit(ok ? 0 : 1);
})();
