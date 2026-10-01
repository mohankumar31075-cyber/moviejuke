'use strict';

/**
 * Moviejuke web server.
 *
 * Zero-dependency Node HTTP server:
 *   - serves the static web client from ./public
 *   - exposes a deterministic JSON API backed by ./data/engine.js
 *   - runs a persistent download queue and library store in ./data/state.json
 *
 * Run:  node server.js [--port 4173]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { URL } = require('url');

const engine = require('./data/engine');
const { THEMES } = require('./data/catalog');

const PORT = Number(process.env.PORT || process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATE_FILE = process.env.MJ_STATE_FILE || path.join(__dirname, 'data', 'state.json');
const VERSION = '1.0.0';

// Simulation knobs. MJ_TICK_MS shortens the queue tick and MJ_SIM_SPEED scales
// the simulated throughput; both exist so `npm test` can drain a queue in
// seconds instead of minutes. Defaults are the shipping values.
const TICK_MS = Number(process.env.MJ_TICK_MS || 700);
const SIM_SPEED = Number(process.env.MJ_SIM_SPEED || 1);

// Hosting knobs. MJ_LOG=1 emits one access-log line per request; gzip is on by
// default for text responses over 1 KB.
const ACCESS_LOG = process.env.MJ_LOG === '1';
const COMPRESS_MIN = 1024;
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-DNS-Prefetch-Control': 'off',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  // deliberately no X-Frame-Options / frame-ancestors: the app is embedded in
  // preview panes by design
};

// ---------------------------------------------------------------- state

const DEFAULT_STATE = {
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
  favorites: {},
  history: {},
  progress: {},
  downloads: [],
  downloadsHistory: [],
  stats: { launches: 0, resolutions: 0, bytesPulled: 0 },
};

let state = loadState();
const saveSoon = debounce(() => {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[moviejuke] state write failed:', err.message);
  }
}, 350);

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}), providers: { ...DEFAULT_STATE.settings.providers, ...(parsed.settings?.providers || {}) } },
      stats: { ...DEFAULT_STATE.stats, ...(parsed.stats || {}) },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------------------------------------------------------------- downloads

let downloadSeq = 0;

function enqueueDownload(body) {
  const rec = engine.INDEX.get(body.titleId);
  if (!rec) return { error: 'Unknown title.' };
  const providerId = body.provider || 'moviebox';
  if (state.settings.providers[providerId] === false) return { error: 'Provider disabled in settings.' };

  const targets = [];
  if (body.allSeasons && rec.kind !== 'm') {
    const season = Number(body.season) || 1;
    const detail = engine.detail(rec.id);
    const block = detail.seasonsDetail.find((s) => s.season === season);
    (block ? block.episodes : []).forEach((ep) => targets.push({ season: ep.season, episode: ep.episode, label: ep.code }));
  } else {
    targets.push({ season: Number(body.season) || 0, episode: Number(body.episode) || 0, label: rec.kind === 'm' ? String(rec.year) : `S${String(body.season || 1).padStart(2, '0')}E${String(body.episode || 1).padStart(2, '0')}` });
  }

  const enabledIds = engine.PROVIDERS.filter((p) => state.settings.providers[p.id] !== false).map((p) => p.id);
  const created = [];
  targets.forEach((target) => {
    const attempt = (pid) => engine.resolveStream(rec, {
      provider: pid,
      quality: body.quality || 'Auto',
      season: target.season,
      episode: target.episode,
      bdix: state.settings.bdix,
    });
    let stream = attempt(providerId);
    let usedProvider = providerId;
    let fallbackFrom = null;
    if (!stream.ok) {
      // Mirror the resolver's behaviour: fall through to the next ready provider.
      const alternate = engine.providerAvailability(rec, { bdix: state.settings.bdix, enabled: enabledIds })
        .find((p) => p.available && p.id !== providerId);
      if (alternate) {
        const second = attempt(alternate.id);
        if (second.ok) {
          fallbackFrom = { providerId, error: stream.error };
          stream = second;
          usedProvider = alternate.id;
        }
      }
    }
    const id = `dl-${Date.now().toString(36)}-${(downloadSeq += 1).toString(36)}`;
    const item = {
      id,
      titleId: rec.id,
      title: rec.title,
      label: target.label,
      kind: rec.kind,
      season: target.season,
      episode: target.episode,
      providerId: usedProvider,
      provider: engine.PROVIDERS.find((p) => p.id === usedProvider)?.name || usedProvider,
      fallbackFrom,
      quality: stream.ok ? stream.quality : (body.quality || '1080p'),
      sizeGb: stream.ok ? stream.sizeGb : 1.2,
      downloadedGb: 0,
      speedMbps: 0,
      segments: stream.ok && stream.multiConnection ? 8 : 1,
      state: stream.ok ? 'downloading' : 'failed',
      error: stream.ok ? null : stream.error,
      addedAt: Date.now(),
      completedAt: null,
      etaSec: null,
      pausedAt: null,
    };
    state.downloads.unshift(item);
    created.push(item);
  });
  saveSoon();
  return { ok: true, items: created };
}

setInterval(() => {
  let dirty = false;
  state.downloads.forEach((item) => {
    if (item.state !== 'downloading') return;
    const seedR = engine.rng(engine.hashSeed(item.id));
    const targetSpeed = (2.5 + seedR() * 34) * (item.providerId === 'circleftp' ? 1.6 : 1) * (item.segments / 8 || 1) * SIM_SPEED;
    item.speedMbps = Number((targetSpeed * (0.82 + Math.random() * 0.3)).toFixed(1));
    const chunk = (item.speedMbps * 1024) / (8 * 1000) * (TICK_MS / 1000) / 1024; // GB per tick
    item.downloadedGb = Math.min(item.sizeGb, item.downloadedGb + Math.max(0.0008, chunk));
    const remaining = item.sizeGb - item.downloadedGb;
    item.etaSec = item.speedMbps > 0 ? Math.round((remaining * 8192) / item.speedMbps) : null;
    if (remaining <= 0.0005) {
      item.state = 'completed';
      item.downloadedGb = item.sizeGb;
      item.speedMbps = 0;
      item.etaSec = 0;
      item.completedAt = Date.now();
      state.downloadsHistory.unshift({ ...item });
      state.downloadsHistory = state.downloadsHistory.slice(0, 60);
      state.stats.bytesPulled += item.sizeGb;
    }
    dirty = true;
  });
  const nowTs = Date.now();
  state.downloads = state.downloads
    .filter((d) => d.state !== 'cancelled')
    .filter((d) => !(d.state === 'completed' && d.completedAt && nowTs - d.completedAt > 5000))
    .slice(0, 80);
  if (dirty) saveSoon();
}, TICK_MS);

// ---------------------------------------------------------------- helpers

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res, body, status = 200) {
  const payload = Buffer.from(JSON.stringify(body));
  const accepts = res.req?.headers['accept-encoding'] || '';
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Accept-Encoding',
  };
  if (payload.length >= COMPRESS_MIN && /\bgzip\b/.test(accepts)) {
    const gz = zlib.gzipSync(payload);
    res.writeHead(status, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
    res.end(gz);
    return;
  }
  res.writeHead(status, { ...headers, 'Content-Length': payload.length });
  res.end(payload);
}

/** Serve a buffer, compressing text and honouring conditional requests. */
function sendAsset(req, res, buf, contentType, cacheControl) {
  const etag = `W/"${buf.length.toString(16)}-${(statTag[req.url] || 0).toString(16)}"`;
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    Vary: 'Accept-Encoding',
    ETag: etag,
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  const compressible = /^(text\/|application\/(json|manifest|javascript)|image\/svg)/.test(contentType);
  if (compressible && buf.length >= COMPRESS_MIN && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const gz = zlib.gzipSync(buf);
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
    res.end(gz);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': buf.length });
  res.end(buf);
}

const statTag = Object.create(null);

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooBig) return resolve({});
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = path.join(PUBLIC_DIR, rel);
  if (!target.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(target, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      if (!path.extname(rel)) {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, index) => {
          if (e2) res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain' }).end('Not found');
          else sendAsset(req, res, index, MIME['.html'], 'no-cache');
        });
        return;
      }
      res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    statTag[req.url] = stat.mtimeMs;
    const ext = path.extname(target);
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=3600';
    fs.readFile(target, (err, buf) => {
      if (err) {
        res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      sendAsset(req, res, buf, MIME[ext] || 'application/octet-stream', cache);
    });
  });
}

// ---------------------------------------------------------------- routes

async function handleApi(req, res, url) {
  const { pathname } = url;
  const q = Object.fromEntries(url.searchParams.entries());
  const method = req.method.toUpperCase();

  if (pathname === '/healthz' || pathname === '/readyz' || pathname === '/api/health') {
    return sendJson(res, { ok: true, version: VERSION, uptime: process.uptime(), node: process.version });
  }

  if (pathname === '/api/meta' && method === 'GET') {
    return sendJson(res, {
      name: 'Moviejuke',
      version: VERSION,
      tagline: 'Terminal-grade discovery for everything you watch, now in the browser.',
      themes: THEMES,
      providers: engine.PROVIDERS,
      qualities: ['Auto', ...engine.QUALITIES],
      subtitles: engine.SUBTITLE_LANGS,
      facets: engine.facets(),
      settings: state.settings,
      profiles: state.profiles,
      currentProfile: state.currentProfile,
      players: [
        { id: 'mpv', label: 'MPV', note: 'Best seeking, hardware decode, custom headers.' },
        { id: 'vlc', label: 'VLC', note: 'Widest codec support, network caching controls.' },
        { id: 'iina', label: 'IINA', note: 'macOS native MPV front-end.' },
        { id: 'android', label: 'Android intent', note: 'Hands the URL to any installed player.' },
      ],
    });
  }

  if (pathname === '/api/home' && method === 'GET') {
    return sendJson(res, engine.home(q.profile));
  }

  if (pathname === '/api/browse' && method === 'GET') {
    return sendJson(res, engine.search(q));
  }

  if (pathname.startsWith('/api/title/') && method === 'GET') {
    const id = decodeURIComponent(pathname.replace('/api/title/', ''));
    const body = engine.detail(id);
    if (!body) return sendJson(res, { error: 'Title not found.' }, 404);
    body.progress = state.progress[profileKey(q.profile)]?.[id] || null;
    body.favorite = (state.favorites[profileKey(q.profile)] || []).includes(id);
    return sendJson(res, body);
  }

  if (pathname === '/api/stream' && method === 'GET') {
    const rec = engine.INDEX.get(q.title);
    if (!rec) return sendJson(res, { error: 'Title not found.' }, 404);
    const providerDisabled = state.settings.providers[q.provider] === false;
    const availability = engine.providerAvailability(rec, { bdix: state.settings.bdix });
    const stream = engine.resolveStream(rec, {
      provider: q.provider,
      quality: q.quality,
      season: q.season,
      episode: q.episode,
      bdix: state.settings.bdix,
      providerDisabled,
    });
    if (!stream.ok) {
      stream.detailId = rec.id;
      stream.alternatives = availability
        .filter((p) => p.id !== (q.provider || 'moviebox'))
        .map((p) => ({ id: p.id, name: p.name, available: p.available, error: p.error, maxQuality: p.maxQuality }));
    }
    state.stats.resolutions += 1;
    saveSoon();
    return sendJson(res, stream, stream.ok ? 200 : 409);
  }

  if (pathname === '/api/live' && method === 'GET') {
    return sendJson(res, engine.live());
  }

  if (pathname === '/api/speedtest' && method === 'GET') {
    return sendJson(res, { testedAt: new Date().toISOString(), results: engine.speedTest() });
  }

  if (pathname === '/api/downloads') {
    if (method === 'GET') {
      return sendJson(res, {
        active: state.downloads,
        history: state.downloadsHistory.slice(0, 40),
        canReach: 'MovieBox CDN · 4KHDHub mirror · CircleFTP (BDIX)',
        totalActive: state.downloads.filter((d) => d.state === 'downloading').length,
        totalBytes: Number(state.stats.bytesPulled.toFixed(2)),
      });
    }
    if (method === 'POST') {
      const body = await readBody(req);
      const result = enqueueDownload(body);
      return sendJson(res, result, result.error ? 400 : 201);
    }
    if (method === 'PATCH') {
      const body = await readBody(req);
      const item = state.downloads.find((d) => d.id === body.id);
      if (!item) return sendJson(res, { error: 'Download not found.' }, 404);
      if (body.action === 'pause' && item.state === 'downloading') {
        item.state = 'paused';
        item.pausedAt = Date.now();
      } else if (body.action === 'resume' && item.state === 'paused') {
        item.state = 'downloading';
      } else if (body.action === 'retry' && item.state === 'failed') {
        item.state = 'downloading';
        item.error = null;
        item.downloadedGb = 0;
      } else if (body.action === 'boost') {
        item.segments = Math.min(16, (item.segments || 1) * 2);
        item.state = item.state === 'paused' ? 'paused' : 'downloading';
      }
      saveSoon();
      return sendJson(res, { ok: true, item });
    }
    if (method === 'DELETE') {
      const body = await readBody(req);
      const before = state.downloads.length;
      state.downloads = state.downloads.filter((d) => d.id !== body.id);
      saveSoon();
      return sendJson(res, { ok: true, removed: before - state.downloads.length });
    }
  }

  if (pathname === '/api/library') {
    const profile = profileKey(q.profile);
    if (method === 'GET') {
      const favs = (state.favorites[profile] || []).map((id) => engine.INDEX.get(id)).filter(Boolean).map(engine.card);
      const history = (state.history[profile] || [])
        .map((h) => ({ ...h, item: engine.INDEX.get(h.titleId) ? engine.card(engine.INDEX.get(h.titleId)) : null }))
        .filter((h) => h.item)
        .slice(0, 40);
      const resume = Object.entries(state.progress[profile] || {})
        .map(([titleId, p]) => {
          const rec = engine.INDEX.get(titleId);
          return rec ? { ...p, item: engine.card(rec) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 20);
      return sendJson(res, { profile, favorites: favs, history, resume });
    }
    if (method === 'POST') {
      const body = await readBody(req);
      state.favorites[profile] = state.favorites[profile] || [];
      state.history[profile] = state.history[profile] || [];
      state.progress[profile] = state.progress[profile] || {};
      if (body.action === 'favorite' && body.titleId) {
        const set = new Set(state.favorites[profile]);
        if (set.has(body.titleId)) set.delete(body.titleId);
        else set.add(body.titleId);
        state.favorites[profile] = [...set];
      } else if (body.action === 'progress' && body.titleId) {
        state.progress[profile][body.titleId] = {
          titleId: body.titleId,
          position: Number(body.position) || 0,
          duration: Number(body.duration) || 0,
          season: Number(body.season) || 0,
          episode: Number(body.episode) || 0,
          updatedAt: Date.now(),
        };
        state.history[profile] = [
          { titleId: body.titleId, at: Date.now(), season: Number(body.season) || 0, episode: Number(body.episode) || 0 },
          ...state.history[profile].filter((h) => h.titleId !== body.titleId),
        ].slice(0, 60);
      } else if (body.action === 'clear-history') {
        state.history[profile] = [];
        state.progress[profile] = {};
      } else if (body.action === 'clear-favorites') {
        state.favorites[profile] = [];
      }
      saveSoon();
      return sendJson(res, { ok: true });
    }
  }

  if (pathname === '/api/settings') {
    if (method === 'GET') return sendJson(res, { settings: state.settings, profiles: state.profiles, currentProfile: state.currentProfile });
    if (method === 'POST') {
      const body = await readBody(req);
      state.settings = {
        ...state.settings,
        ...body,
        providers: { ...state.settings.providers, ...(body.providers || {}) },
      };
      if (body.currentProfile) state.currentProfile = body.currentProfile;
      saveSoon();
      return sendJson(res, { ok: true, settings: state.settings });
    }
  }

  if (pathname === '/api/stats' && method === 'POST') {
    const body = await readBody(req);
    if (body.action === 'launch') state.stats.launches += 1;
    saveSoon();
    return sendJson(res, { ok: true, stats: state.stats });
  }

  if (pathname === '/api/stats' && method === 'GET') {
    return sendJson(res, {
      ...state.stats,
      downloadsToday: state.downloadsHistory.filter((d) => Date.now() - d.completedAt < 86400000).length,
      favorites: Object.values(state.favorites).flat().length,
      uptimeSec: Math.round(process.uptime()),
      engine: { titles: engine.RECORDS.length, providers: engine.PROVIDERS.length, channels: engine.live().channels.length },
    });
  }

  if (pathname === '/api/changelog' && method === 'GET') {
    return sendJson(res, { entries: CHANGELOG });
  }

  return sendJson(res, { error: `No route for ${method} ${pathname}` }, 404);
}

function profileKey(profile) {
  return profile && state.profiles.some((p) => p.id === profile) ? profile : state.currentProfile;
}

const CHANGELOG = [
  {
    version: 'v1.0.0', date: '2026-10-01', label: 'Web release',
    sections: [
      { title: 'Added', items: ['Browser client with home deck, browse, title pages and live TV.', 'Server-side multi-segment download queue with pause, resume and retry.', '9 themes, 4 providers, 4 player launch profiles.'] },
      { title: 'Performance', items: ['Deterministic engine: every request resolves from one seeded index.', 'Zero third-party runtime dependencies.'] },
    ],
  },
  {
    version: 'v0.1.21', date: '2026-09-18', label: 'Upstream reference',
    sections: [
      { title: 'Added', items: ['Issue quality templates wired to the documentation site.', 'OS labelling and semver release validation on issues.'] },
      { title: 'Fixed', items: ['4KHDHub mediator redirector resolution (greenmotors.club, greenmountmotors).', 'Playback vs download mirror separation via ResolutionIntent.'] },
      { title: 'Changed', items: ['Provider errors compacted to sub-40-character status lines.'] },
    ],
  },
];

// ---------------------------------------------------------------- server

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (ACCESS_LOG) {
    const started = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${url.pathname}${url.search} → ${res.statusCode} ${Date.now() - started}ms`);
    });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      console.error('[moviejuke] api error:', err);
      sendJson(res, { error: 'Internal error', detail: err.message }, 500);
    });
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  const stats = {
    titles: engine.RECORDS.length,
    providers: engine.PROVIDERS.length,
    channels: engine.live().channels.length,
  };
  console.log(`Moviejuke ${VERSION} listening on http://${HOST}:${PORT}`);
  console.log(`  index  : ${stats.titles} titles · ${stats.channels} live channels · ${stats.providers} providers`);
  console.log(`  client : ${PUBLIC_DIR}`);
  if (SIM_SPEED !== 1 || TICK_MS !== 700) console.log(`  sim    : tick=${TICK_MS}ms speed=${SIM_SPEED}x`);
});

function shutdown() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* ignore */ }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
