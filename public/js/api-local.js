/**
 * Static transport.
 *
 * GitHub Pages (and any plain static host) cannot run the Node server, so
 * `scripts/build-static.js` prerenders the whole catalogue into /api/*.json and
 * this module reimplements the small amount of behaviour that must stay live:
 * search, stream resolution, the download queue, library state and settings.
 *
 * Library, settings and queue state live in localStorage, keyed per profile —
 * the same shapes the HTTP transport returns, so views never branch.
 */

import { store, setSettingsSaver, hashSeed, makeRng } from './state.js';

const BASE = (typeof window !== 'undefined' && window.__MJ_STATIC_BASE__) || './api';
const LS = {
  settings: 'mj:settings',
  library: (p) => `mj:library:${p}`,
  queue: 'mj:queue',
  stats: 'mj:stats',
};

const SAMPLE_STREAMS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
];

const cache = new Map();

/* ------------------------------------------------------------------ storage */

const memory = new Map();

/** localStorage when the browser allows it, an in-memory map otherwise. */
const storage = (() => {
  try {
    const probe = '__mj_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    };
  }
})();

function read(key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch { /* private mode / quota — the UI stays usable in-memory */ }
}

async function getJson(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const res = await fetch(`${BASE}/${rel}`);
  if (!res.ok) {
    const err = new Error(`Prerendered payload missing: ${rel}`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  cache.set(rel, body);
  return body;
}

const profileOf = (profile) => profile || store.get().profile || 'p1';

/* ------------------------------------------------------------------- library */

function libraryState(profile) {
  return read(LS.library(profile), { favorites: [], history: [], progress: {} });
}

function saveLibrary(profile, state) {
  write(LS.library(profile), state);
}

/* ------------------------------------------------------------------- settings */

function settingsState() {
  const defaults = store.get().meta?.settings || {};
  return { ...defaults, ...read(LS.settings, {}) };
}

setSettingsSaver(async (patch) => {
  const next = { ...settingsState(), ...patch, providers: { ...settingsState().providers, ...(patch.providers || {}) } };
  write(LS.settings, next);
  if (patch.currentProfile) {
    write('mj:currentProfile', patch.currentProfile);
    store.set({ profile: patch.currentProfile });
  }
  return next;
});

/* ------------------------------------------------------------------- helpers */

const KIND_MAP = { movies: 'm', series: 's', anime: 'a', drama: 'd' };

function scoreOf(card, q) {
  const title = card.title.toLowerCase();
  let score = 0;
  if (title === q) score += 100;
  if (title.startsWith(q)) score += 50;
  if (title.includes(q)) score += 25;
  if ((card.cast || []).some((c) => c.toLowerCase().includes(q))) score += 12;
  if (card.genres.some((g) => g.toLowerCase().includes(q))) score += 8;
  score += (card.popularity || 0) / 10;
  return score;
}

function token() {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function playerCommands(url, headers) {
  const ref = headers.Referer;
  return [
    { player: 'mpv', label: 'MPV', command: `mpv --force-seekable=yes --http-header-fields="Referer: ${ref}" "${url}"`, platforms: ['macOS', 'Linux', 'Windows', 'Termux'] },
    { player: 'vlc', label: 'VLC', command: `vlc --http-referrer="${ref}" --network-caching=1500 "${url}"`, platforms: ['macOS', 'Linux', 'Windows', 'Android'] },
    { player: 'iina', label: 'IINA', command: `iina --no-stdin --mpv-force-seekable=yes "${url}"`, platforms: ['macOS'] },
    { player: 'android', label: 'Android intent', command: `am start -a android.intent.action.VIEW -d "${url}"`, platforms: ['Termux'] },
  ];
}

/* ------------------------------------------------------------------- queue */

let ticker = null;

function queueState() {
  return read(LS.queue, { active: [], history: [], bytesPulled: 0 });
}

function saveQueue(state) {
  write(LS.queue, state);
}

function startTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    const state = queueState();
    let dirty = false;
    let finished = false;
    state.active.forEach((item) => {
      if (item.state !== 'downloading') return;
      const r = makeRng(hashSeed(item.id));
      const target = (2.5 + r() * 34) * (item.segments / 8 || 1);
      item.speedMbps = Number((target * (0.82 + Math.random() * 0.3)).toFixed(1));
      const chunk = ((item.speedMbps * 1024) / 8) * 0.7 / 1024 / 1024 * 12; // GB per tick
      item.downloadedGb = Math.min(item.sizeGb, item.downloadedGb + Math.max(0.0008, chunk));
      item.etaSec = item.speedMbps > 0 ? Math.round(((item.sizeGb - item.downloadedGb) * 8192) / item.speedMbps) : null;
      if (item.sizeGb - item.downloadedGb <= 0.0005) {
        item.state = 'completed';
        item.downloadedGb = item.sizeGb;
        item.speedMbps = 0;
        item.etaSec = 0;
        item.completedAt = Date.now();
        finished = true;
      }
      dirty = true;
    });
    if (finished) {
      const done = state.active.filter((d) => d.state === 'completed');
      state.history = [...done.map((d) => ({ ...d })), ...state.history].slice(0, 40);
      state.bytesPulled = Number((state.bytesPulled + done.reduce((n, d) => n + d.sizeGb, 0)).toFixed(4));
      state.active = state.active.filter((d) => d.state !== 'completed' || Date.now() - d.completedAt < 5000);
      dirty = true;
    }
    state.active = state.active.filter((d) => d.state !== 'cancelled');
    if (dirty) saveQueue(state);
  }, 700);
}

function bump(kind, amount = 0) {
  const stats = read(LS.stats, { launches: 0, resolutions: 0, bytesPulled: 0 });
  stats[kind] = (stats[kind] || 0) + amount;
  write(LS.stats, stats);
  return stats;
}

/* ------------------------------------------------------------------- API */

export const staticApi = {
  async meta() {
    const meta = await getJson('meta.json');
    const storedSettings = read(LS.settings, {});
    const currentProfile = read('mj:currentProfile', meta.currentProfile);
    return {
      ...meta,
      settings: { ...meta.settings, ...storedSettings },
      currentProfile,
      transport: 'static',
    };
  },

  async home() {
    const home = await getJson('home.json');
    // home.json bakes a build-time snapshot of the live strip; re-anchor it to
    // the viewer's clock so "Live now" is always current
    const live = await this.live();
    return { ...home, liveNow: live.channels.slice(0, 8) };
  },

  async browse(params = {}) {
    const [catalog, meta] = await Promise.all([getJson('catalog.json'), getJson('meta.json')]);
    const q = String(params.q || '').trim().toLowerCase();
    let items = catalog.slice();

    if (q) {
      items = items.filter((card) => {
        const hay = [card.title, card.director, ...card.genres, ...(card.cast || []), ...card.languages, card.kindLabel].join(' ').toLowerCase();
        return q.split(/\s+/).every((t) => hay.includes(t));
      });
      items.sort((a, b) => scoreOf(b, q) - scoreOf(a, q));
    }

    if (params.kind && params.kind !== 'all') items = items.filter((c) => c.kind === params.kind);
    if (params.type && params.type !== 'all' && KIND_MAP[params.type]) items = items.filter((c) => c.kind === KIND_MAP[params.type]);
    if (params.genre && params.genre !== 'all') items = items.filter((c) => c.genres.includes(params.genre));
    if (params.language && params.language !== 'all') items = items.filter((c) => c.languages.includes(params.language));
    if (params.year && params.year !== 'all') items = items.filter((c) => String(c.year) === String(params.year));
    if (params.minRating) items = items.filter((c) => c.rating >= Number(params.minRating));

    const sorters = {
      popularity: (a, b) => b.popularity - a.popularity,
      rating: (a, b) => b.rating - a.rating,
      newest: (a, b) => b.year - a.year || b.addedAt - a.addedAt,
      oldest: (a, b) => a.year - b.year,
      title: (a, b) => a.title.localeCompare(b.title),
      runtime: (a, b) => b.runtime - a.runtime,
    };
    if (!q || params.sort) items.sort(sorters[params.sort] || sorters.popularity);

    const perPage = Math.min(60, Math.max(1, Number(params.perPage) || 24));
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
    return { query: params.q || '', total, page, pages, perPage, facets: meta.facets, items: items.slice((page - 1) * perPage, page * perPage) };
  },

  async title(id, profile) {
    const detail = await getJson(`titles/${id}.json`);
    const lib = libraryState(profileOf(profile));
    return {
      ...detail,
      favorite: lib.favorites.includes(id),
      progress: lib.progress[id] || null,
    };
  },

  async stream(params = {}) {
    const rec = await getJson(`titles/${params.title}.json`);
    const providerId = params.provider || 'moviebox';
    const provider = rec.providers.find((p) => p.id === providerId) || rec.providers[0];
    const settings = settingsState();

    if (settings.providers && settings.providers[provider.id] === false) {
      throwResolver(`${provider.name} disabled in settings.`, provider, rec);
    }
    if (provider.id === 'circleftp' && settings.bdix === false) {
      throwResolver('CircleFTP unreachable: requires BDIX network.', { id: 'circleftp', name: 'CircleFTP' }, rec);
    }
    if (!provider.available) {
      throwResolver(provider.error || 'Provider unavailable.', provider, rec);
    }

    const season = Number(params.season) || (rec.kind === 'm' ? 0 : 1);
    const episode = Number(params.episode) || (rec.kind === 'm' ? 0 : 1);
    const wanted = params.quality && params.quality !== 'Auto' ? params.quality : null;
    const ladder = rec.releases.filter((r) => r.providerId === provider.id);
    const release = (wanted && ladder.find((r) => r.quality === wanted)) || ladder.find((r) => r.quality === '1080p') || ladder[0];
    if (!release) {
      throwResolver('No releases for that quality.', provider, rec);
    }

    // releases are prerendered for S01E01; retarget the episode label and scale
    // the size by that episode's runtime so the numbers stay believable
    const block = (rec.seasonsDetail || []).find((b) => b.season === season);
    const ep = block ? block.episodes.find((e) => e.episode === episode) : null;
    const ratio = ep ? ep.runtime / Math.max(1, rec.runtime) : 1;
    const sizeGb = Number((release.sizeGb * ratio).toFixed(2));
    const size = sizeGb >= 1 ? `${sizeGb.toFixed(sizeGb >= 10 ? 0 : 1)} GB` : `${Math.round(sizeGb * 1024)} MB`;
    const name = release.name.replace(/S\d{2}E\d{2}/, `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`);
    const tok = token();
    const url = `${SAMPLE_STREAMS[hashSeed(rec.id) % SAMPLE_STREAMS.length]}#mj-${tok}`;
    const headers = {
      Referer: `https://${provider.id}.moviebox.example/embed/${rec.id}`,
      'User-Agent': 'Moviejuke/1.0 (static)',
      Cookie: `mj_session=${tok.slice(0, 12)}`,
    };

    bump('resolutions', 1);
    return {
      ok: true,
      id: release.id,
      title: rec.title,
      subtitle: rec.kind === 'm' ? `${rec.year} · ${release.quality}` : `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} · ${release.quality}`,
      provider: provider.name,
      providerId: provider.id,
      transport: provider.transport,
      quality: release.quality,
      releaseName: name,
      size,
      sizeGb,
      audio: release.audio,
      video: release.video,
      hdr: release.hdr,
      seeders: release.seeders,
      multiConnection: release.multiConnection,
      latencyMs: release.latencyMs,
      url,
      headers,
      subtitles: rec.subtitles,
      token: tok,
      expiresAt: Date.now() + 1000 * 60 * 90,
      commands: playerCommands(url, headers),
      delivery: release.multiConnection ? 'multi-segment (8 connections)' : 'single connection',
      sampleFallback: true,
    };
  },

  async live() {
    const live = await getJson('live.json');
    const nowMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
    const mm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const channels = live.channels.map((ch) => {
      const schedule = ch.schedule;
      const current = schedule.find((s) => nowMinutes >= s.start && nowMinutes < s.start + s.length) || schedule[0];
      const idx = schedule.indexOf(current);
      const next = schedule[idx + 1] || schedule[0];
      const progress = ((nowMinutes - current.start) / current.length) * 100;
      const decorate = (slot) => ({ ...slot, startLabel: mm(slot.start), endLabel: mm(slot.start + slot.length) });
      return {
        ...ch,
        now: decorate(current),
        next: decorate(next),
        progress: Number(Math.max(0, Math.min(100, progress)).toFixed(2)),
        epg: schedule.map(decorate),
      };
    });
    return { ...live, channels };
  },

  async speedTest() {
    const meta = await getJson('meta.json');
    const bucket = Math.floor(Date.now() / 60000);
    return {
      testedAt: new Date().toISOString(),
      results: meta.providers.map((p) => {
        const r = makeRng(hashSeed(`${p.id}:${bucket}`));
        const latency = Math.round(24 + r() * 320);
        return {
          providerId: p.id,
          provider: p.name,
          region: p.region,
          latencyMs: latency,
          throughput: `${(2 + r() * 46).toFixed(1)} MB/s`,
          jitter: `${(1 + r() * 24).toFixed(1)} ms`,
          packetLoss: `${(r() * 2.4).toFixed(2)}%`,
          verdict: r() > 0.35 ? 'Ready' : 'Degraded',
          mirror: ['eu-west-1', 'ap-south-1', 'us-east-1', 'bd-dhaka-1', 'sg-1'][Math.floor(r() * 5)],
        };
      }),
    };
  },

  async downloads() {
    startTicker();
    const state = queueState();
    return {
      active: state.active,
      history: state.history.slice(0, 40),
      canReach: 'MovieBox CDN · 4KHDHub mirror · CircleFTP (BDIX)',
      totalActive: state.active.filter((d) => d.state === 'downloading').length,
      totalBytes: state.bytesPulled || 0,
    };
  },

  async enqueue(body) {
    const rec = await getJson(`titles/${body.titleId}.json`);
    const lib = queueState();
    const targets = [];
    if (body.allSeasons && rec.kind !== 'm') {
      const block = (rec.seasonsDetail || []).find((b) => b.season === (Number(body.season) || 1));
      (block ? block.episodes : []).forEach((ep) => targets.push({ season: ep.season, episode: ep.episode, label: ep.code, runtime: ep.runtime }));
    } else {
      targets.push({
        season: Number(body.season) || 0,
        episode: Number(body.episode) || 0,
        label: rec.kind === 'm' ? String(rec.year) : `S${String(body.season || 1).padStart(2, '0')}E${String(body.episode || 1).padStart(2, '0')}`,
        runtime: rec.runtime,
      });
    }

    const providerId = body.provider || 'moviebox';
    const items = targets.map((target, i) => {
      const seedR = makeRng(hashSeed(`${rec.id}:${providerId}:${target.label}`));
      const sizeGb = Number((((rec.kind === 'm' ? rec.runtime : target.runtime) * 0.036 * (0.85 + seedR() * 0.35))).toFixed(2));
      return {
        id: `dl-local-${Date.now().toString(36)}-${i}`,
        titleId: rec.id,
        title: rec.title,
        label: target.label,
        kind: rec.kind,
        season: target.season,
        episode: target.episode,
        providerId,
        provider: (store.get().meta?.providers || []).find((p) => p.id === providerId)?.name || providerId,
        quality: body.quality && body.quality !== 'Auto' ? body.quality : '1080p',
        sizeGb: Math.max(0.2, sizeGb),
        downloadedGb: 0,
        speedMbps: 0,
        segments: 8,
        state: 'downloading',
        error: null,
        addedAt: Date.now(),
        completedAt: null,
        etaSec: null,
        pausedAt: null,
      };
    });

    lib.active = [...items, ...lib.active].slice(0, 80);
    saveQueue(lib);
    startTicker();
    return { ok: true, items };
  },

  async downloadAction(body) {
    const state = queueState();
    const item = state.active.find((d) => d.id === body.id);
    if (!item) {
      const err = new Error('Download not found.');
      err.status = 404;
      throw err;
    }
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
    }
    saveQueue(state);
    return { ok: true, item };
  },

  async removeDownload(id) {
    const state = queueState();
    const before = state.active.length;
    state.active = state.active.filter((d) => d.id !== id);
    saveQueue(state);
    return { ok: true, removed: before - state.active.length };
  },

  async library(profile) {
    const key = profileOf(profile);
    const [catalog, lib] = await Promise.all([getJson('catalog.json'), Promise.resolve(libraryState(key))]);
    const byId = new Map(catalog.map((c) => [c.id, c]));
    return {
      profile: key,
      favorites: lib.favorites.map((id) => byId.get(id)).filter(Boolean),
      history: lib.history
        .map((h) => ({ ...h, item: byId.get(h.titleId) }))
        .filter((h) => h.item)
        .slice(0, 40),
      resume: Object.values(lib.progress)
        .map((p) => ({ ...p, item: byId.get(p.titleId) }))
        .filter((p) => p.item)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 20),
    };
  },

  async libraryAction(profile, body) {
    const key = profileOf(profile);
    const lib = libraryState(key);
    if (body.action === 'favorite' && body.titleId) {
      lib.favorites = lib.favorites.includes(body.titleId)
        ? lib.favorites.filter((id) => id !== body.titleId)
        : [...lib.favorites, body.titleId];
    } else if (body.action === 'progress' && body.titleId) {
      lib.progress[body.titleId] = {
        titleId: body.titleId,
        position: Number(body.position) || 0,
        duration: Number(body.duration) || 0,
        season: Number(body.season) || 0,
        episode: Number(body.episode) || 0,
        updatedAt: Date.now(),
      };
      lib.history = [{ titleId: body.titleId, at: Date.now(), season: Number(body.season) || 0, episode: Number(body.episode) || 0 }, ...lib.history.filter((h) => h.titleId !== body.titleId)].slice(0, 60);
    } else if (body.action === 'clear-history') {
      lib.history = [];
      lib.progress = {};
    } else if (body.action === 'clear-favorites') {
      lib.favorites = [];
    }
    saveLibrary(key, lib);
    return { ok: true };
  },

  async settings(body) {
    const meta = await getJson('meta.json');
    if (!body) {
      return { settings: settingsState(), profiles: meta.profiles, currentProfile: profileOf() };
    }
    const next = { ...settingsState(), ...body, providers: { ...settingsState().providers, ...(body.providers || {}) } };
    write(LS.settings, next);
    if (body.currentProfile) {
      write('mj:currentProfile', body.currentProfile);
      store.set({ profile: body.currentProfile });
    }
    return { ok: true, settings: next };
  },

  async stats() {
    const [meta, queue] = await Promise.all([getJson('meta.json'), Promise.resolve(queueState())]);
    const stats = read(LS.stats, { launches: 0, resolutions: 0, bytesPulled: 0 });
    const favorites = ['p1', 'p2', 'p3', 'p4'].reduce((n, p) => n + libraryState(p).favorites.length, 0);
    return {
      launches: stats.launches || 0,
      resolutions: stats.resolutions || 0,
      bytesPulled: queue.bytesPulled || 0,
      downloadsToday: queue.history.filter((d) => Date.now() - d.completedAt < 86400000).length,
      favorites,
      uptimeSec: Math.round(performance.now() / 1000),
      engine: { titles: (await getJson('catalog.json')).length, providers: meta.providers.length, channels: (await getJson('live.json')).channels.length },
      transport: 'static',
    };
  },

  async launch() {
    bump('launches', 1);
    return { ok: true };
  },
};

/**
 * Mirror of the HTTP transport's 409 payload: the UI's failure path catches a
 * thrown error carrying { error, alternatives } and offers fallback providers.
 */
function throwResolver(error, provider, rec) {
  const err = new Error(error);
  err.status = 409;
  err.body = {
    ok: false,
    error,
    providerId: provider.id,
    provider: provider.name,
    detailId: rec.id,
    alternatives: alternativesFor(rec, provider.id),
  };
  throw err;
}

function alternativesFor(rec, providerId) {
  return rec.providers
    .filter((p) => p.id !== providerId)
    .map((p) => ({ id: p.id, name: p.name, available: p.available, error: p.error, maxQuality: p.maxQuality }));
}
