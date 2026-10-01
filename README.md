# Moviejuke

**Terminal-grade discovery, streaming and downloads for movies, series, anime, Asian dramas and live TV — rebuilt as a browser app.**

Moviejuke is a self-contained web application in the spirit of [`MovieBox-Tui`](https://github.com/mesamirh/MovieBox-Tui):
the same keyboard-first workflow, provider stack, resolution picker, batch downloader and
theme system, but served as a single-page client over a small JSON API.

Zero runtime dependencies — Node's standard library on the server, plain ES modules in the browser.
No build step, no bundler, no CDN.

```bash
node server.js          # → http://localhost:4173
npm test                # 61 API/queue checks, no dependencies required
```

---

## What it does

| Area | Behaviour |
| --- | --- |
| **Discovery** | 70-title curated index across movies, series, anime and Asian dramas, with 23 genres, 12 languages and faceted browsing (kind, genre, language, year, minimum rating, six sort orders, pagination). |
| **Title pages** | Poster hero, tagline, cast, provider availability matrix, full episode listings per season, release browser (14+ releases per title), subtitle tracks and similar titles. |
| **Provider stack** | MovieBox (DASH + HLS), 4KHDHub (HubCloud/HubDrive style mirrors), CircleFTP (BDIX-only) and community Stremio-style addons. Availability is per title *and* per provider, so the picker, resolver and queue never contradict each other. |
| **Resolution** | Quality ladder (`4K` → `480p` + `Auto`), per-release size/audio/HDR/multi-connection metadata, response-time scoring, and compact TUI-style failure reasons such as `CircleFTP unreachable: requires BDIX network.` or `Mirrors dead or expired.` Failures always offer a working fallback provider. |
| **Playback** | In-browser player with transport controls, live transport inspector (endpoint, referer, latency, expiry) and subtitle list, plus copy-ready launch commands for **MPV, VLC, IINA and Android `am start` intents**. |
| **Downloads** | Server-side multi-segment queue with real progress ticks, pause, resume, boost (×2 connection pool), retry, delete, ETA/speed readouts, per-segment bar strip, completion history and lifetime byte accounting. |
| **Live TV** | 34-channel M3U/EPG lineup across movies, sports, news, documentary, kids, drama, music and entertainment, with a 24-hour rolling guide, per-channel stream contract and playlist import preview. |
| **Library** | Four isolated profiles, favorites, watch history and continue-watching progress with resume rails, all persisted to `data/state.json`. Zero telemetry. |
| **Interface** | Nine themes (Moviejuke, Catppuccin Mocha, Tokyo Night, Dracula, Nord, Gruvbox Dark, One Dark, Solarized Light, Monochrome), configurable accent, three densities, reduced-motion mode, command palette, shortcut sheet and a live status bar. |

## Quick start

```bash
git clone <this repo> && cd moviejuke
node server.js                 # or: npm start
# → Moviejuke 1.0.0 listening on http://0.0.0.0:4173
```

Useful flags / environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` or `--port=8080` | `4173` | HTTP port. |
| `HOST` | `0.0.0.0` | Bind address. |
| `MJ_STATE_FILE` | `data/state.json` | Where profiles, favorites, history, queue and settings live. |
| `MJ_TICK_MS` | `700` | Download queue tick interval. |
| `MJ_SIM_SPEED` | `1` | Simulated throughput multiplier (used by the test suite). |

## Interface

| Shortcut | Action |
| --- | --- |
| `/` | Focus search |
| `⌘/Ctrl + K` | Command palette (titles, views, diagnostics) |
| `g` then `h` `b` `l` `d` `y` `s` | Home · Browse · Live TV · Downloads · Library · Settings |
| `Enter` | Open the focused card |
| `?` | Shortcut sheet |
| `Esc` | Close any overlay |

## Architecture

```
moviejuke/
├── server.js              # HTTP server, REST API, download engine, persistence
├── data/
│   ├── catalog.js         # hand-written titles, channels, provider registry
│   └── engine.js          # deterministic resolver: releases, episodes, EPG, search
├── public/
│   ├── index.html
│   ├── css/app.css        # design system + nine themes via CSS custom properties
│   └── js/
│       ├── app.js         # shell: routing, chrome, palette, keyboard, status bar
│       ├── api.js         # fetch client + store + settings application
│       ├── art.js         # procedural cover art + icon set
│       ├── components.js  # hyperscript, cards, shelves, modals, toasts, player
│       ├── flows.js       # play / download / resolver-failure flows
│       └── views/         # home, browse, title, live, downloads, library, settings
└── scripts/smoke.js       # dependency-free end-to-end test
```

### Design notes

* **Deterministic engine.** Every release, seed count, file size, episode title and EPG slot is derived
  from a hash of the title id through a seeded PRNG. Reloading the page never reshuffles the library.
* **Procedural artwork.** Posters and backdrops are generated as seeded SVG data URIs (gradients, geometry,
  grain, wrapped titles) — no external image hosts, so nothing can 404.
* **Provider realism.** Availability is a per-title roll against each provider's reliability; BDIX gating
  short-circuits CircleFTP; disabled providers are removed from the resolver and from the queue.
* **Simulated by design.** Playback resolves to public sample video fixtures and falls back to a synthesised
  transport visualiser when no CDN route exists; live channels, speed tests and transfers are generated locally.
  No scraping, no torrenting, no upstream media service is contacted.

## API

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness, version, uptime. |
| `GET` | `/api/meta` | Themes, providers, qualities, subtitles, facets, players, settings, profiles. |
| `GET` | `/api/home?profile=p1` | Hero deck, shelves, index stats, live strip, provider matrix. |
| `GET` | `/api/browse` | Search + facets + sort + pagination (`q`, `kind`, `genre`, `language`, `year`, `minRating`, `sort`, `page`). |
| `GET` | `/api/title/:id` | Full detail payload (episodes, releases, subtitles, similar, progress, favorite). |
| `GET` | `/api/stream` | Resolve a playable release (`title`, `provider`, `quality`, `season`, `episode`); `409` + fallback list on failure. |
| `GET` | `/api/live` | Channel grid, 24h EPG, M3U playlist preview. |
| `GET` | `/api/speedtest` | Per-mirror latency, throughput, jitter, loss, verdict. |
| `GET/POST/PATCH/DELETE` | `/api/downloads` | Queue inspection, enqueue, pause/resume/boost/retry, remove. |
| `GET/POST` | `/api/library?profile=p1` | Favorites, history, resume progress; clear actions. |
| `GET/POST` | `/api/settings` | Read/write theme, accent, providers, BDIX, quality, player, profile. |
| `GET/POST` | `/api/stats` | Session counters (launches, resolutions, bytes pulled) and engine facts. |
| `GET` | `/api/changelog` | Release notes rendered in-app. |

## Testing

```bash
npm test        # boots the real server on a scratch port and runs 61 assertions
```

Coverage includes static asset delivery, catalogue/search/pagination, title detail, resolver success,
disabled-provider and BDIX gating, fallback payloads, live EPG integrity, speed tests, per-profile library
isolation, and the full download lifecycle (enqueue → progress → pause → frozen when paused → resume →
boost → delete → complete → retire to history).

The client itself was validated with a jsdom render harness that boots every view, asserts DOM structure
and exercises the play picker and resolver-failure modals (22 checks).

## Browser support

The client targets evergreen browsers: it leans on CSS custom properties, `color-mix()`, CSS grid,
`aspect-ratio` and ES modules (Chrome 111+, Safari 16.4+, Firefox 113+, Edge 111+). Layouts stay usable in
older engines but accent tinting degrades to the flat theme colours.

## Attribution & disclaimer

Moviejuke is an independent, non-commercial demonstration project inspired by the feature set and interface
conventions of [`MovieBox-Tui`](https://github.com/mesamirh/MovieBox-Tui) (MIT/Apache-2.0). It is **not**
affiliated with, endorsed by, or connected to that project, MovieBox, 4KHDHub, Stremio or any listed provider.

All titles, artwork, metadata, channels, providers and network statistics in this repository are fictional or
generated. The app deliberately integrates no scraper, torrent client or third-party media endpoint, and is
intended as a UI/architecture demo.
