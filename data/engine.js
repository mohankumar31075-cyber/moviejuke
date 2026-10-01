'use strict';

/**
 * Moviejuke engine.
 *
 * Deterministic expansion layer between the hand-written catalogue in
 * `catalog.js` and the JSON API in `server.js`. Everything is seeded by the
 * title id so a movie always resolves to the same releases, seeds, sizes and
 * subtitle tracks — the UI never "shuffles" between requests.
 */

const crypto = require('crypto');
const { TITLES, CHANNELS, PROVIDERS, QUALITIES, SUBTITLE_LANGS } = require('./catalog');

// ---------------------------------------------------------------- utilities

function hashSeed(str) {
  const h = crypto.createHash('sha1').update(String(str)).digest();
  return h.readUInt32BE(0);
}

/** mulberry32 — small, fast, deterministic PRNG. */
function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

function slug(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const KIND_LABEL = { m: 'Movie', s: 'Series', a: 'Anime', d: 'Asian Drama' };
const KIND_COLLECTION = { m: 'Movies', s: 'TV Series', a: 'Anime', d: 'Asian Dramas' };

function fmtBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i < 2 ? 0 : 1)} ${units[i]}`;
}

// ---------------------------------------------------------------- catalogue

const EPISODE_WORDS = [
  'Cold Open', 'Half Light', 'The Long Way Down', 'Static', 'Salt and Iron', 'Nine of Cups',
  'Backchannel', 'The Quiet Part', 'Low Orbit', 'Paper Trail', 'Blackout Window', 'Second Sun',
  'Homecoming', 'The Ledger', 'Dust and Signal', 'Nightshade', 'Terminal Velocity', 'Slow Burn',
  'The Understudy', 'Threshold', 'Tidewater', 'The Better Angel', 'Ground Truth', 'Aftershock',
  'Mirrorball', 'The Reckoning', 'Splinter', 'Blue Hour', 'Nocturne', 'The Salt Line',
];

const PROGRAMS = {
  Movies: ['Feature Presentation', 'Late Night Double Bill', 'Director\'s Vault', 'Cult Classics', 'World Cinema'],
  Sports: ['Live: Derby Night', 'Match of the Day', 'Highlights Reel', 'Transfer Desk', 'Classic Finals'],
  News: ['Top of the Hour', 'The Briefing', 'Markets Live', 'World Report', 'The Long Read'],
  Documentary: ['Planet in Motion', 'Built to Last', 'Deep Field', 'The Archive Room', 'Wild Frontiers'],
  Kids: ['Morning Toons', 'Adventure Block', 'Story Hour', 'Cartoon Marathon', 'Junior Quiz'],
  Drama: ['Prime Drama', 'Episode Marathon', 'Romance Slot', 'Family Secrets', 'Late Drama'],
  Music: ['The Countdown', 'Live Sessions', 'Retro Hour', 'New This Week', 'Club Classics'],
  Entertainment: ['Talk of the Town', 'Kitchen Rivals', 'Panel Show', 'Reality Round', 'Comedy Hour'],
};

const now = () => Date.now();

// ---------------------------------------------------------------- records

const INDEX = new Map();

function buildRecords() {
  const records = TITLES.map((raw) => {
    const id = slug(raw.t);
    const seed = hashSeed(id);
    const r = rng(seed);
    const totalMinutes = raw.k === 'm' ? raw.rt : raw.rt * raw.eps * (raw.seasons || 1);
    const payload = {
      id,
      title: raw.t,
      year: raw.y,
      kind: raw.k,
      kindLabel: KIND_LABEL[raw.k],
      collection: KIND_COLLECTION[raw.k],
      rating: raw.r,
      votes: Math.round(1200 + r() * 480000),
      runtime: raw.rt,
      runtimeLabel: raw.k === 'm' ? `${Math.floor(raw.rt / 60)}h ${raw.rt % 60}m` : `${raw.rt}m per episode`,
      genres: raw.g,
      languages: raw.lg,
      country: raw.co || '—',
      synopsis: raw.s,
      tagline: buildTagline(raw, r),
      director: raw.d,
      cast: raw.c,
      accent: raw.col,
      popularity: raw.pop,
      badges: buildBadges(raw, r),
      seasons: raw.k === 'm' ? 0 : raw.seasons,
      episodesPerSeason: raw.k === 'm' ? 0 : raw.eps,
      seed,
      addedAt: Date.now() - Math.round(r() * 220 * 86400000),
      totalMinutes,
      totalSize: fmtBytes(totalMinutes * 1024 * 1024 * (0.9 + r() * 0.6) * 12),
    };
    return payload;
  });
  records.forEach((rec) => INDEX.set(rec.id, rec));
  return records;
}

function buildTagline(raw, r) {
  const pools = {
    m: ['Every choice costs a version of you.', 'Some doors only open inward.', 'One more take. One more night.'],
    s: ['The truth keeps office hours.', 'Nobody leaves clean.', 'Season one changes everything.'],
    a: ['The journey outlasts the hero.', 'Power has a price and a receipt.', 'Some stories take a thousand years.'],
    d: ['Love arrives at the worst possible gate.', 'Debt is a kind of family.', 'What survives is what you choose.'],
  };
  return pick(r, pools[raw.k] || pools.m);
}

function buildBadges(raw, r) {
  const badges = [];
  if (raw.r >= 8.5) badges.push('Top Rated');
  if (raw.pop >= 88) badges.push('Trending');
  const roll = r();
  if (roll > 0.55) badges.push('4K HDR');
  else if (roll > 0.3) badges.push('1080p');
  if (raw.k === 'a') badges.push('Sub | Dub');
  if (raw.k === 'd') badges.push('Multi-Sub');
  if (r() > 0.7) badges.push('Dolby Atmos');
  return badges;
}

let RECORDS = buildRecords();

// ---------------------------------------------------------------- episodes

function buildEpisodes(rec) {
  if (rec.kind === 'm') return [];
  const seasons = [];
  for (let s = 1; s <= rec.seasons; s += 1) {
    const r = rng(rec.seed + s * 977);
    const count = rec.episodesPerSeason + (s === rec.seasons ? Math.floor(r() * 4) - 1 : 0);
    const eps = [];
    for (let e = 1; e <= Math.max(4, count); e += 1) {
      const er = rng(rec.seed + s * 7919 + e * 131);
      const title = pick(er, EPISODE_WORDS);
      const runtime = rec.runtime + Math.round(er() * 8) - 3;
      const aired = new Date(rec.addedAt - (rec.seasons - s) * 200 * 86400000 + e * 7 * 86400000);
      eps.push({
        season: s,
        episode: e,
        code: `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`,
        title,
        runtime,
        airDate: aired.toISOString().slice(0, 10),
        rating: Number((6.9 + er() * 2.6).toFixed(1)),
        synopsis: `${title}: ${rec.synopsis.split('. ')[0]}. This hour leans on ${pick(er, rec.genres).toLowerCase()} and leaves one thread deliberately loose.`,
        watched: false,
      });
    }
    seasons.push({ season: s, episodes: eps, count: eps.length });
  }
  return seasons;
}

// ---------------------------------------------------------------- releases

const VIDEO_TAGS = ['WEB-DL', 'WEBRip', 'BluRay', 'HDTV', 'Remux'];
const AUDIO_TAGS = ['AAC 2.0', 'EAC3 5.1', 'DDP 5.1', 'TrueHD 7.1', 'Atmos 7.1'];
const SOURCE_GROUPS = ['MOVIEJUKE', 'NOVA', 'RARBGX', 'PSA', 'TIGOLE', 'EDGE2026'];

function buildReleases(rec, opts = {}) {
  const season = opts.season || (rec.kind === 'm' ? 0 : 1);
  const episode = opts.episode || (rec.kind === 'm' ? 0 : 1);
  const releases = [];
  PROVIDERS.forEach((prov, pi) => {
    const r = rng(rec.seed + pi * 104729 + season * 31 + episode * 7);
    const qualities = qualityLadder(rec, prov, r);
    qualities.forEach((quality, qi) => {
      const sizeGb = sizeFor(rec, quality, season, episode, r);
      const name = releaseName(rec, { quality, season, episode, r, provider: prov });
      releases.push({
        id: `${rec.id}-${prov.id}-${quality}-${season}-${episode}`,
        providerId: prov.id,
        provider: prov.name,
        quality,
        transport: prov.transport,
        size: fmtBytes(sizeGb * 1024 ** 3),
        sizeGb: Number(sizeGb.toFixed(2)),
        name,
        seeders: prov.transport === 'Torrent' ? Math.round(4 + r() * 320) : null,
        multiConnection: r() > 0.35,
        audio: pick(r, AUDIO_TAGS),
        video: pick(r, VIDEO_TAGS),
        hdr: quality === '4K' ? pick(r, ['HDR10', 'HDR10+', 'Dolby Vision']) : null,
        released: new Date(Date.now() - Math.round(r() * 90 * 86400000)).toISOString().slice(0, 10),
        score: Math.round(60 + r() * 39 - qi * 2),
        latencyMs: Math.round(80 + r() * 900),
      });
    });
  });
  return releases.sort((a, b) => b.score - a.score);
}

function qualityLadder(rec, prov, r) {
  const base = QUALITIES.slice(0);
  let out = base;
  if (prov.maxQuality === '1080p') out = base.filter((q) => q !== '4K' && q !== '1440p');
  if (prov.transport === 'Torrent') out = base.filter((q) => q !== '1440p');
  if (rec.kind === 'a' || rec.kind === 'd') out = out.filter((q) => q !== '1440p');
  const drop = Math.floor(r() * out.length);
  out = out.filter((_, i) => i !== drop || out.length <= 3);
  return out.slice(0, 4);
}

function sizeFor(rec, quality, season, episode, r) {
  const perMin = { '4K': 0.115, '1440p': 0.062, '1080p': 0.036, '720p': 0.019, '480p': 0.008 }[quality] || 0.03;
  const minutes = rec.kind === 'm' ? rec.runtime : rec.runtime;
  const jitter = 0.85 + r() * 0.35;
  return Math.max(0.18, perMin * minutes * jitter);
}

function releaseName(rec, o) {
  const { quality, season, episode, r, provider } = o;
  const group = pick(r, SOURCE_GROUPS);
  const code = rec.kind === 'm' ? String(rec.year) : `S${String(season).padStart(2, '0')}${episode ? `E${String(episode).padStart(2, '0')}` : ''}`;
  const q = quality === '4K' ? '2160p' : quality;
  return `${rec.title.replace(/[^A-Za-z0-9]+/g, '.')}.${code}.${q}.${pick(r, VIDEO_TAGS)}.${pick(r, AUDIO_TAGS).replace(/\s/g, '')}.${provider.tag.toUpperCase()}-${group}`;
}

/**
 * Compact, TUI-flavoured failure reasons — mirrors ProviderError::user_message.
 * Availability is keyed per title+provider (not per episode) so a title either
 * has a live mirror on a provider or it does not, and the UI never contradicts
 * itself between the picker, the resolver and the queue.
 */
function providerUnavailable(rec, prov, ctx = {}) {
  if (prov.id === 'circleftp' && ctx.bdix === false) {
    return 'CircleFTP unreachable: requires BDIX network.';
  }
  const r = rng(hashSeed(`${rec.id}:${prov.id}`));
  if (r() > prov.reliable) {
    const reasons = {
      moviebox: ['MovieBox timed out.', 'MovieBox returned an empty manifest.'],
      fourkhdhub: ['Mirrors dead or expired.', 'Cannot reach 4KHDHub.', '4KHDHub timed out.'],
      circleftp: ['CircleFTP unreachable: requires BDIX network.', 'CircleFTP mirror offline.'],
      addons: ['Blocked torrent streams. HTTP only.', 'No addon responded in time.'],
    };
    return pick(r, reasons[prov.id] || ['Provider unavailable.']);
  }
  return null;
}

function buildSubtitles(rec) {
  const r = rng(rec.seed + 4242);
  const langs = SUBTITLE_LANGS.filter((l) => rec.languages.includes(l) || r() > 0.55);
  return langs.slice(0, 7).map((lang) => ({
    lang,
    code: { English: 'en', Bengali: 'bn', Hindi: 'hi', Spanish: 'es', French: 'fr', German: 'de', Japanese: 'ja', Korean: 'ko', Arabic: 'ar' }[lang] || 'en',
    hi: /Bengali|Hindi/.test(lang) ? false : r() > 0.7,
    format: r() > 0.5 ? 'SRT' : 'ASS',
    size: `${Math.round(18 + r() * 90)} KB`,
  }));
}

// ---------------------------------------------------------------- resolution

const SAMPLE_STREAMS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
];

function resolveStream(rec, opts = {}) {
  const providerId = opts.provider || 'moviebox';
  const prov = PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];
  const season = Number(opts.season) || (rec.kind === 'm' ? 0 : 1);
  const episode = Number(opts.episode) || (rec.kind === 'm' ? 0 : 1);
  const ctx = { season, episode, bdix: opts.bdix !== false };
  const failure = providerUnavailable(rec, prov, ctx);
  if (failure) return { ok: false, error: failure, providerId: prov.id, provider: prov.name };
  if (opts.providerDisabled) {
    return { ok: false, error: `${prov.name} disabled in settings.`, providerId: prov.id, provider: prov.name };
  }

  const releases = buildReleases(rec, { season, episode }).filter((x) => x.providerId === prov.id);
  const requested = opts.quality && opts.quality !== 'Auto' ? opts.quality : null;
  const release = requested
    ? releases.find((x) => x.quality === requested) || releases[0]
    : releases.find((x) => x.quality === '1080p') || releases[0];

  const r = rng(hashSeed(release.id));
  const token = crypto.createHash('sha1').update(`${rec.id}:${release.id}:${now()}`).digest('hex').slice(0, 24);
  const url = `${SAMPLE_STREAMS[rec.seed % SAMPLE_STREAMS.length]}#mj-${token}`;
  const headers = {
    Referer: `https://${prov.id}.moviebox.example/embed/${rec.id}`,
    'User-Agent': 'Moviejuke/1.0 (+web)',
    Cookie: `mj_session=${token.slice(0, 12)}`,
  };

  return {
    ok: true,
    id: release.id,
    title: rec.title,
    subtitle: rec.kind === 'm' ? `${rec.year} · ${release.quality}` : `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} · ${release.quality}`,
    provider: prov.name,
    providerId: prov.id,
    transport: prov.transport,
    quality: release.quality,
    releaseName: release.name,
    size: release.size,
    sizeGb: release.sizeGb,
    audio: release.audio,
    video: release.video,
    hdr: release.hdr,
    seeders: release.seeders,
    multiConnection: release.multiConnection,
    latencyMs: release.latencyMs,
    url,
    headers,
    subtitles: buildSubtitles(rec),
    token,
    expiresAt: now() + 1000 * 60 * 90,
    commands: playerCommands(url, headers),
    delivery: release.multiConnection ? 'multi-segment (8 connections)' : 'single connection',
    sampleFallback: true,
  };
}

function playerCommands(url, headers) {
  const ref = headers.Referer;
  return [
    {
      player: 'mpv',
      label: 'MPV',
      command: `mpv --force-seekable=yes --http-header-fields="Referer: ${ref}" "${url}"`,
      platforms: ['macOS', 'Linux', 'Windows', 'Termux'],
    },
    {
      player: 'vlc',
      label: 'VLC',
      command: `vlc --http-referrer="${ref}" --network-caching=1500 "${url}"`,
      platforms: ['macOS', 'Linux', 'Windows', 'Android'],
    },
    {
      player: 'iina',
      label: 'IINA',
      command: `iina --no-stdin --mpv-force-seekable=yes "${url}"`,
      platforms: ['macOS'],
    },
    {
      player: 'android',
      label: 'Android intent',
      command: `am start -a android.intent.action.VIEW -d "${url}"`,
      platforms: ['Termux'],
    },
  ];
}

/**
 * Provider availability snapshot for a title.
 * @param {object} rec  catalogue record
 * @param {object} opts { bdix?: boolean, enabled?: string[] }
 */
function providerAvailability(rec, opts = {}) {
  const enabled = opts.enabled || null;
  return PROVIDERS.map((prov) => {
    const error = providerUnavailable(rec, prov, { season: 1, episode: 1, bdix: opts.bdix !== false });
    const disabled = enabled ? !enabled.includes(prov.id) : false;
    return { ...prov, available: !error && !disabled, disabled, error: disabled ? 'Disabled in settings.' : error };
  });
}

/** First provider (by preference order) that can actually serve this title. */
function bestProvider(rec, opts = {}) {
  return providerAvailability(rec, opts).find((p) => p.available) || null;
}

// ---------------------------------------------------------------- search

function normalizeQuery(q) {
  return String(q || '').trim().toLowerCase();
}

function search(opts = {}) {
  const q = normalizeQuery(opts.q);
  let items = RECORDS.slice();

  if (q) {
    items = items.filter((rec) => {
      const hay = [rec.title, rec.director, ...rec.genres, ...rec.cast, ...rec.languages, rec.kindLabel].join(' ').toLowerCase();
      return q.split(/\s+/).every((token) => hay.includes(token));
    });
    items.sort((a, b) => scoreOf(b, q) - scoreOf(a, q));
  }

  if (opts.kind && opts.kind !== 'all') items = items.filter((rec) => rec.kind === opts.kind);
  if (opts.genre && opts.genre !== 'all') items = items.filter((rec) => rec.genres.includes(opts.genre));
  if (opts.language && opts.language !== 'all') items = items.filter((rec) => rec.languages.includes(opts.language));
  if (opts.type && opts.type !== 'all') {
    const map = { movies: 'm', series: 's', anime: 'a', drama: 'd' };
    if (map[opts.type]) items = items.filter((rec) => rec.kind === map[opts.type]);
  }
  if (opts.year && opts.year !== 'all') items = items.filter((rec) => String(rec.year) === String(opts.year));
  if (opts.minRating) items = items.filter((rec) => rec.rating >= Number(opts.minRating));

  const sorters = {
    popularity: (a, b) => b.popularity - a.popularity,
    rating: (a, b) => b.rating - a.rating,
    newest: (a, b) => b.year - a.year || b.addedAt - a.addedAt,
    oldest: (a, b) => a.year - b.year,
    title: (a, b) => a.title.localeCompare(b.title),
    runtime: (a, b) => b.runtime - a.runtime,
  };
  if (!q || opts.sort) items.sort(sorters[opts.sort] || sorters.popularity);

  const perPage = Math.min(60, Math.max(1, Number(opts.perPage) || 24));
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(pages, Math.max(1, Number(opts.page) || 1));
  const slice = items.slice((page - 1) * perPage, page * perPage);

  return {
    query: opts.q || '',
    total,
    page,
    pages,
    perPage,
    facets: facets(),
    items: slice.map(card),
  };
}

function scoreOf(rec, q) {
  const title = rec.title.toLowerCase();
  let score = 0;
  if (title === q) score += 100;
  if (title.startsWith(q)) score += 50;
  if (title.includes(q)) score += 25;
  if (rec.cast.some((c) => c.toLowerCase().includes(q))) score += 12;
  if (rec.genres.some((g) => g.toLowerCase().includes(q))) score += 8;
  score += rec.popularity / 10;
  return score;
}

function facets() {
  const genres = new Set();
  const languages = new Set();
  const years = new Set();
  RECORDS.forEach((rec) => {
    rec.genres.forEach((g) => genres.add(g));
    rec.languages.forEach((l) => languages.add(l));
    years.add(rec.year);
  });
  return {
    genres: [...genres].sort(),
    languages: [...languages].sort(),
    years: [...years].sort((a, b) => b - a),
    kinds: [
      { id: 'all', label: 'Everything' },
      { id: 'm', label: 'Movies' },
      { id: 's', label: 'Series' },
      { id: 'a', label: 'Anime' },
      { id: 'd', label: 'Asian Drama' },
    ],
  };
}

/** Trimmed record used in grids and shelves. */
function card(rec) {
  return {
    id: rec.id,
    title: rec.title,
    year: rec.year,
    kind: rec.kind,
    kindLabel: rec.kindLabel,
    collection: rec.collection,
    rating: rec.rating,
    runtimeLabel: rec.runtimeLabel,
    genres: rec.genres,
    accent: rec.accent,
    badges: rec.badges,
    languages: rec.languages,
    synopsis: rec.synopsis.length > 180 ? `${rec.synopsis.slice(0, 177)}…` : rec.synopsis,
    seasons: rec.seasons,
    popularity: rec.popularity,
    tagline: rec.tagline,
  };
}

function detail(id) {
  const rec = INDEX.get(id);
  if (!rec) return null;
  const releases = buildReleases(rec);
  const providerState = PROVIDERS.map((prov) => {
    const err = providerUnavailable(rec, prov, { season: 1, episode: 1, bdix: true });
    const list = releases.filter((x) => x.providerId === prov.id);
    return {
      ...prov,
      available: !err,
      error: err,
      count: err ? 0 : list.length,
      bestQuality: list[0] ? list.reduce((best, x) => (QUALITIES.indexOf(x.quality) < QUALITIES.indexOf(best.quality) ? x.quality : best), list[0].quality) : null,
    };
  });
  const similar = RECORDS.filter((x) => x.id !== rec.id && x.genres.some((g) => rec.genres.includes(g)))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 8)
    .map(card);

  return {
    ...card(rec),
    synopsis: rec.synopsis,
    tagline: rec.tagline,
    director: rec.director,
    cast: rec.cast,
    languages: rec.languages,
    totalSize: rec.totalSize,
    votes: rec.votes,
    accent: rec.accent,
    addedAt: new Date(rec.addedAt).toISOString().slice(0, 10),
    seasonsDetail: buildEpisodes(rec),
    providers: providerState,
    releases,
    subtitles: buildSubtitles(rec),
    similar,
  };
}

function home(profile) {
  const by = (fn, n) => RECORDS.slice().sort(fn).slice(0, n).map(card);
  const heroes = by((a, b) => b.popularity + b.rating * 2 - (a.popularity + a.rating * 2), 5);
  const rows = [
    { id: 'trending', title: 'Trending Now', subtitle: 'What the swarm is resolving right now', items: by((a, b) => b.popularity - a.popularity, 14) },
    { id: 'new', title: 'Fresh on the index', subtitle: 'Newest additions across every provider', items: by((a, b) => b.year - a.year || b.addedAt - a.addedAt, 14) },
    { id: 'top', title: 'Top Rated', subtitle: 'Nothing under 8.0', items: by((a, b) => b.rating - a.rating, 14) },
    { id: 'movies', title: 'Movies', subtitle: 'Feature length, all providers', items: browseKind('m', 14) },
    { id: 'series', title: 'TV Series', subtitle: 'Seasons, episodes, batch downloads', items: browseKind('s', 14) },
    { id: 'anime', title: 'Anime', subtitle: 'Sub and dub tracks included', items: browseKind('a', 14) },
    { id: 'drama', title: 'Asian Dramas', subtitle: 'Korean, Japanese, Mandarin', items: browseKind('d', 14) },
    { id: 'fourk', title: '4K HDR Vault', subtitle: 'High bitrate releases with Atmos audio', items: RECORDS.filter((r) => r.badges.includes('4K HDR')).sort((a, b) => b.popularity - a.popularity).slice(0, 14).map(card) },
  ];
  return {
    hero: heroes.map((h) => ({ ...h, synopsis: INDEX.get(h.id).synopsis })),
    rows: rows.filter((row) => row.items.length),
    stats: {
      titles: RECORDS.length,
      movies: RECORDS.filter((r) => r.kind === 'm').length,
      series: RECORDS.filter((r) => r.kind === 's').length,
      anime: RECORDS.filter((r) => r.kind === 'a').length,
      drama: RECORDS.filter((r) => r.kind === 'd').length,
      episodes: RECORDS.reduce((sum, r) => sum + (r.kind === 'm' ? 0 : r.seasons * r.episodesPerSeason), 0),
      channels: CHANNELS.length,
      providers: PROVIDERS.length,
    },
    liveNow: live().channels.slice(0, 8),
    providers: PROVIDERS,
  };
}

function browseKind(kind, n) {
  return RECORDS.filter((r) => r.kind === kind).sort((a, b) => b.popularity - a.popularity).slice(0, n).map(card);
}

// ---------------------------------------------------------------- live tv

function live() {
  const minutesNow = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  const channels = CHANNELS.map((ch, i) => {
    const id = `live-${slug(ch.t)}`;
    const r = rng(hashSeed(id));
    const slots = PROGRAMS[ch.cat] || PROGRAMS.Entertainment;
    const schedule = [];
    let cursor = 0;
    let gi = 0;
    while (cursor < 24 * 60) {
      const length = [30, 45, 60, 90, 120][Math.floor(r() * 5)];
      schedule.push({
        title: slots[gi % slots.length],
        start: cursor,
        length,
        rating: Number((6 + r() * 3.8).toFixed(1)),
      });
      cursor += length;
      gi += 1;
    }
    const current = schedule.find((s) => minutesNow >= s.start && minutesNow < s.start + s.length) || schedule[0];
    const idx = schedule.indexOf(current);
    const nextSlot = schedule[idx + 1] || schedule[0];
    const progress = ((minutesNow - current.start) / current.length) * 100;
    const mm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return {
      id,
      number: 100 + i,
      name: ch.t,
      category: ch.cat,
      region: ch.region,
      accent: ch.col,
      quality: ch.hd,
      language: ch.lang,
      bitrate: ch.bitrate,
      viewers: Math.round(140 + r() * 48000),
      uptime: `${(96 + r() * 3.8).toFixed(2)}%`,
      now: { ...current, startLabel: mm(current.start), endLabel: mm(current.start + current.length) },
      next: { ...nextSlot, startLabel: mm(nextSlot.start), endLabel: mm(nextSlot.start + nextSlot.length) },
      progress: Number(progress.toFixed(2)),
      epg: schedule.map((s) => ({ ...s, startLabel: mm(s.start), endLabel: mm(s.start + s.length) })),
      stream: {
        url: `https://stream.moviejuke.example/live/${slug(ch.t)}/index.m3u8`,
        format: ch.hd === '4K' ? 'HLS · HEVC · fMP4' : 'HLS · H.264 · TS',
        userAgent: `MoviejukeLive/1.0 (${ch.region})`,
      },
    };
  });
  return {
    categories: ['All', ...new Set(CHANNELS.map((c) => c.cat))],
    regions: ['All', ...new Set(CHANNELS.map((c) => c.region))],
    channels,
    epgWindow: '24h rolling · generated from M3U + EPG source',
    playlist: `#EXTM3U\n${channels.slice(0, 3).map((c) => `#EXTINF:-1 tvg-id="${c.id}" group-title="${c.category}",${c.name}\n${c.stream.url}`).join('\n')}\n#EXTM3U ... ${channels.length} channels total`,
  };
}

// ---------------------------------------------------------------- speed test

function speedTest() {
  return PROVIDERS.map((prov, i) => {
    const r = rng(hashSeed(prov.id) + Math.floor(now() / 60000));
    return {
      providerId: prov.id,
      provider: prov.name,
      region: prov.region,
      latencyMs: Math.round(24 + r() * 320),
      throughput: `${(2 + r() * 46).toFixed(1)} MB/s`,
      jitter: `${(1 + r() * 24).toFixed(1)} ms`,
      packetLoss: `${(r() * 2.4).toFixed(2)}%`,
      verdict: r() > 0.35 ? 'Ready' : 'Degraded',
      mirror: pick(r, ['eu-west-1', 'ap-south-1', 'us-east-1', 'bd-dhaka-1', 'sg-1']),
    };
  });
}

module.exports = {
  RECORDS,
  PROVIDERS,
  QUALITIES,
  SUBTITLE_LANGS,
  INDEX,
  providerAvailability,
  providerUnavailable,
  bestProvider,
  card,
  detail,
  facets,
  home,
  live,
  search,
  resolveStream,
  buildReleases,
  buildEpisodes,
  speedTest,
  slug,
  hashSeed,
  rng,
  fmtBytes,
  KIND_LABEL,
};
