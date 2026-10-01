# Moviejuke

**Terminal-grade discovery, streaming and downloads for movies, series, anime, Asian dramas and live TV — rebuilt as a browser app.**

Moviejuke is a self-contained web application in the spirit of [`MovieBox-Tui`](https://github.com/mesamirh/MovieBox-Tui):
the same keyboard-first workflow, provider stack, resolution picker, batch downloader and
theme system, but served as a single-page client over a small JSON API.

Zero runtime dependencies — Node's standard library on the server, plain ES modules in the browser.
No build step, no bundler, no CDN.

```bash
node server.js          # → http://localhost:4173   (full app: API + queue + state)
npm test                # 61 API/queue checks, no dependencies required
npm run build:static    # → dist/ prerendered site for static hosting
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
│       ├── api.js         # transport selection: HTTP client or static client
│       ├── api-local.js   # static transport: prerendered data + localStorage
│       ├── state.js       # shared store, toasts, theme + settings persistence
│       ├── art.js         # procedural cover art + icon set
│       ├── components.js  # hyperscript, cards, shelves, modals, toasts, player
│       ├── flows.js       # play / download / resolver-failure flows
│       └── views/         # home, browse, title, live, downloads, library, settings
├── scripts/
│   ├── smoke.js           # dependency-free end-to-end API test
│   ├── build-static.js    # prerenders dist/ for GitHub Pages
│   └── dom-harness.mjs    # optional jsdom render suite (both transports)
└── deploy: Dockerfile · docker-compose.yml · render.yaml · fly.toml · railway.json · Procfile
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

## Deployment

Moviejuke ships in two shapes, and every path below is already wired up in this repository.

| Path | What runs | Cost |
| --- | --- | --- |
| **GitHub Pages** (`pages.yml`) | Prerendered static build — no server, no secrets | free |
| **Netlify** (`netlify.toml`) | Prerendered static build — build command `npm run build`, publish `dist` | free |
| **Container** (`docker.yml` → GHCR) | Full app: live API, download queue, persisted state | free registry |
| **Render / Fly / Railway / any VPS** | Full app via the bundled blueprints | free tiers available |

### 1. GitHub Pages (static, zero infrastructure)

The Pages workflow prerenders the entire catalogue (`npm run build:static` → `dist/`) and publishes it.
Search, stream resolution, the download queue, library and settings all run in the browser against that
prerendered data, with `localStorage` for per-visitor state.

**One-time step (repository admin):** `Settings → Pages → Build and deployment → Source: GitHub Actions`.
After that, every push to `main` publishes automatically and the site lives at
`https://<owner>.github.io/<repo>/`.

The workflow builds and verifies the artifact first, then checks whether Pages is enabled: if it is not,
the run still succeeds and the job summary explains exactly which toggle to flip, instead of failing with a
permissions error.

To preview the same artifact locally:

```bash
npm run build:static     # writes dist/  (~1.3 MB, 70 title payloads + catalogue)
npm run serve:static     # → http://localhost:4174
```

### 2. Container (full app)

```bash
docker build -t moviejuke .
docker run -p 8080:8080 moviejuke          # → http://localhost:8080
# or, with persistent state:
docker compose up --build
```

The `Container` workflow publishes multi-arch images to GHCR on every push to `main`:

```bash
docker run -p 8080:8080 ghcr.io/<owner>/moviejuke:latest
```

### Netlify

`netlify.toml` is checked in, so importing the repository is all that is needed:
build command `npm run build`, publish directory `dist`, Node 22, and cache/security headers.

```
Add new site → Import an existing project → pick this repo → Deploy
```

**Netlify cannot run the Node server.** It serves static files, so `node server.js` (the live API, download
queue and state file) will not start there. Netlify must publish the prerendered `dist/` build, where the
client resolves everything in the browser.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Page not found` at the site root | Publish directory is the **repository root**, which has no `index.html` | Set publish directory to `dist` (picked up automatically from `netlify.toml`) |
| Page loads, then a red card: *"Cannot reach the Moviejuke backend."* | Publishing **`public/`** — that is the raw client, which expects the Node API at `/api/*` | Publish `dist/` instead, or use a host that runs Node (Render, Fly, Railway, Docker) |
| Deploy log: *"build.command failed"* / missing `build` script | Platform default is `npm run build` | `package.json` now defines `build` as an alias for the static build |
| Deploy succeeded but the site 404s | The deploy is unpublished, or the site is still building | Check the **Deploys** tab for a published deploy; the first build takes ~1 minute |

Verify locally exactly what Netlify will serve:

```bash
npm run build          # → dist/
npm run serve:static   # → http://localhost:4174  (same artifact, no backend)
```

### 3. One-click hosts

Each file is ready to use — no edits required beyond picking your region/plan.

<details>
<summary><b>Render</b> — <code>render.yaml</code> blueprint</summary>

Dashboard → **New → Blueprint** → select this repository. Render reads `render.yaml`
(Node runtime, no build step because there are no dependencies) and health-checks `/healthz`.
</details>

<details>
<summary><b>Fly.io</b> — <code>fly.toml</code></summary>

```bash
fly launch --copy-config --name moviejuke
fly deploy
fly volumes create moviejuke_data --size 1   # optional: persist state, then unmount-block in fly.toml
```
</details>

<details>
<summary><b>Railway</b> — <code>railway.json</code></summary>

New Project → **Deploy from GitHub repo** → Railway picks up `railway.json`
(Nixpacks build, `node server.js`, `/healthz` health check).
</details>

<details>
<summary><b>Any VPS / systemd</b></summary>

```bash
git clone <this repo> /opt/moviejuke && cd /opt/moviejuke
node server.js                      # behind nginx/caddy; set PORT and HOST as needed
```

`Procfile` is included for Procfile-based platforms (`web: node server.js`).
</details>

### Production behaviour

| Concern | Handling |
| --- | --- |
| Port / bind | `PORT` (default `4173`, or `8080` in the image) and `HOST` (default `0.0.0.0`) |
| Health checks | `/healthz` and `/readyz` return `{ ok, version, uptime, node }` |
| Compression | gzip for HTML/JS/CSS/JSON/SVG over 1 KB (title detail: 18 KB → 3.9 KB) |
| Caching | `no-cache` for HTML, `max-age=3600` for assets, weak `ETag` + `304` support |
| Security headers | `nosniff`, `Referrer-Policy: no-referrer`, DNS-prefetch off, minimal permissions policy — deliberately **no** frame-blocking so preview panes keep working |
| Graceful shutdown | `SIGTERM`/`SIGINT` flush the state file before exit |
| Logging | `MJ_LOG=1` emits one access-log line per request |
| Scaling caveat | State is one JSON file, so run **one** replica per host (or mount a volume). Swap `data/state.json` for a database to scale horizontally. |
| SPA routing | Unknown extension-less paths fall back to `index.html`; the client is hash-routed, so no rewrite rules are needed |

### CI

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | every push / PR | syntax-checks all modules, runs the 61-assertion API suite, then the jsdom render suite against **both** transports (server + static artifact) |
| `pages.yml` | push to `main`, manual | builds `dist/`, verifies the artifact is self-contained, publishes to GitHub Pages |
| `docker.yml` | push to `main`/tags, PRs | builds the image, publishes to GHCR, then boots the container and curls `/healthz` and `/api/meta` |

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

Deploying the static build makes that explicit: the Pages version runs entirely in your browser against a
prerendered catalogue, and stores favorites, history and the download queue in `localStorage`.
