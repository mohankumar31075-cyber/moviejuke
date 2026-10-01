/** Moviejuke client shell: routing, chrome, palette, keyboard, live status. */

import { api, store, toast, applySettings, updateSettings } from './api.js';
import { h, mountToasts, svgIcon, closeModal, hasModal, modal, fmt } from './components.js';
import * as homeView from './views/home.js';
import * as browseView from './views/browse.js';
import * as titleView from './views/title.js';
import * as liveView from './views/live.js';
import * as downloadsView from './views/downloads.js';
import * as libraryView from './views/library.js';
import * as settingsView from './views/settings.js';

const ROUTES = [
  { id: 'home', path: /^#?\/?$/, label: 'Home', key: 'h', icon: 'home' },
  { id: 'browse', path: /^#\/browse/, label: 'Browse', key: 'b', icon: 'grid' },
  { id: 'live', path: /^#\/live/, label: 'Live TV', key: 'l', icon: 'tv' },
  { id: 'downloads', path: /^#\/downloads/, label: 'Downloads', key: 'd', icon: 'download' },
  { id: 'library', path: /^#\/library/, label: 'Library', key: 'y', icon: 'book' },
  { id: 'settings', path: /^#\/settings/, label: 'Settings', key: 's', icon: 'gear' },
  { id: 'title', path: /^#\/title\/([^?/]+)/, label: 'Title', hidden: true },
];

const VIEWS = {
  home: homeView,
  browse: browseView,
  title: titleView,
  live: liveView,
  downloads: downloadsView,
  library: libraryView,
  settings: settingsView,
};

let current = null;
let viewRoot = null;
let downloadCount = 0;

async function boot() {
  mountToasts();
  viewRoot = document.getElementById('view');
  renderChromeLoading();

  let meta;
  try {
    meta = await api.meta();
  } catch (err) {
    viewRoot.replaceChildren(h('div', { class: 'empty' },
      h('div', { class: 'big' }, '!'),
      h('div', {}, 'Cannot reach the Moviejuke backend.'),
      h('div', { class: 'mono muted' }, err.message)));
    return;
  }

  store.set({ meta, settings: meta.settings, profiles: meta.profiles, profile: meta.currentProfile });
  applySettings(meta.settings);
  document.title = `Moviejuke — ${meta.tagline}`;
  renderChrome();
  window.addEventListener('hashchange', route);
  route();
  startStatusPolling();
  bindKeyboard();
}

/* ---------------------------------------------------------------- chrome */

function renderChromeLoading() {
  const topbar = document.getElementById('topbar');
  topbar.replaceChildren(h('div', { class: 'brand' },
    h('div', { class: 'brand-mark' }, 'MJ'),
    h('div', { class: 'brand-text' }, h('span', { class: 'brand-name' }, 'Moviejuke'), h('span', { class: 'brand-sub' }, 'booting…'))));
}

function renderChrome() {
  const { meta, profile, profiles } = store.get();
  const topbar = document.getElementById('topbar');
  const active = profiles.find((p) => p.id === profile) || profiles[0];

  const search = h('input', {
    type: 'search',
    placeholder: 'Search movies, series, anime, dramas…',
    'aria-label': 'Search',
    id: 'global-search',
    onkeydown: (e) => {
      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
        location.hash = `#/browse?q=${encodeURIComponent(e.currentTarget.value.trim())}`;
        e.currentTarget.blur();
      }
      if (e.key === 'Escape') e.currentTarget.blur();
    },
  });

  const navLinks = ROUTES.filter((r) => !r.hidden).map((r) => h('a', {
    href: `#/${r.id === 'home' ? '' : r.id}`,
    dataset: { route: r.id },
    onclick: () => setTimeout(markNav, 0),
  }, svgIcon(r.icon, 15), r.label, h('span', { class: 'k' }, r.key)));

  topbar.replaceChildren(
    h('div', { class: 'brand', onclick: () => { location.hash = '#/'; } },
      h('div', { class: 'brand-mark' }, 'MJ'),
      h('div', { class: 'brand-text' },
        h('span', { class: 'brand-name' }, 'Moviejuke'),
        h('span', { class: 'brand-sub' }, `v${meta.version} · web`))),
    h('nav', { class: 'nav' }, navLinks),
    h('div', { class: 'searchbox' },
      h('span', { class: 'glass' }, svgIcon('search', 15)),
      search,
      h('span', { class: 'hint' }, '/')),
    h('button', { class: 'icon-btn', title: 'Command palette (⌘K)', onclick: () => openPalette() }, svgIcon('terminal', 15)),
    h('button', { class: 'icon-btn', title: 'Shortcuts (?)', onclick: showShortcuts }, svgIcon('bolt', 15)),
    h('div', { class: 'profile-chip', title: 'Switch profile', onclick: showProfiles },
      h('div', { class: 'avatar', style: { background: active.accent } }, active.name.split(' ').map((w) => w[0]).join('').slice(0, 2)),
      h('span', { style: { fontSize: '12.5px' } }, active.name)),
  );
  markNav();
}

function markNav() {
  const id = routeId(location.hash);
  document.querySelectorAll('.nav a[data-route]').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === id || (id === 'title' && a.dataset.route === 'browse'));
  });
}

function renderStatus() {
  const { settings, meta } = store.get();
  const enabled = meta.providers.filter((p) => settings.providers?.[p.id] !== false);
  const bar = document.getElementById('statusbar');
  const clock = new Date().toLocaleTimeString([], { hour12: false });
  bar.replaceChildren(
    h('span', { class: 'seg' }, h('span', { class: 'dot blip' }), `${enabled.length}/${meta.providers.length} providers live`),
    h('span', { class: 'seg' }, h('span', { class: `dot ${settings.bdix ? '' : 'err'}` }), settings.bdix ? 'BDIX reachable' : 'BDIX blocked'),
    h('span', { class: 'seg' }, `theme: ${settings.theme.toLowerCase()}`),
    h('span', { class: 'seg' }, `quality: ${settings.defaultQuality.toLowerCase()}`),
    h('span', { class: 'seg' }, `player: ${settings.player}`),
    h('span', { class: 'seg' }, `queue: ${downloadCount} active`),
    h('span', { class: 'seg' }, `engine: ${meta.facets.genres.length} genres · ${meta.subtitles.length} subtitle langs`),
    h('span', { class: 'seg' }, `session: ${clock}`),
    h('span', { class: 'seg' }, h('a', { href: '#/settings', style: { color: 'inherit' } }, 'configure ↗')),
  );
}

function startStatusPolling() {
  renderStatus();
  const tick = async () => {
    try {
      const res = await api.downloads();
      downloadCount = (res.active || []).filter((d) => d.state === 'downloading').length;
    } catch {
      downloadCount = 0;
    }
    renderStatus();
  };
  tick();
  setInterval(tick, 5000);
}

/* ---------------------------------------------------------------- routing */

function routeId(hash) {
  const found = ROUTES.find((r) => r.path.test(hash || '#/'));
  return found ? found.id : 'home';
}

function parse(hash) {
  const raw = (hash || '#/').replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const name = segments[0] || 'home';
  const params = { id: segments[1] ? decodeURIComponent(segments[1]) : undefined };
  return { name, params, query: new URLSearchParams(queryPart || '') };
}

async function route() {
  const { name, params, query } = parse(location.hash);
  const view = VIEWS[name] || VIEWS.home;
  if (current?.teardown) current.teardown();
  current = view;
  markNav();
  const { profile, meta, settings } = store.get();
  if (name === 'browse' && meta) {
    viewRoot.replaceChildren(h('div', { class: 'mono muted', style: { padding: '30px' } }, 'loading index…'));
  }
  try {
    const el = await view.render({ params, query, profile, meta, settings, refresh: () => route() });
    viewRoot.replaceChildren(el);
    window.scrollTo({ top: 0 });
  } catch (err) {
    viewRoot.replaceChildren(h('div', { class: 'empty' },
      h('div', { class: 'big' }, '∅'),
      h('div', {}, 'That view failed to load.'),
      h('div', { class: 'mono muted' }, err.message),
      h('div', { style: { marginTop: '14px' } },
        h('button', { class: 'btn sm', onclick: () => { location.hash = '#/'; } }, 'Back home'))));
  }
}

/* ---------------------------------------------------------------- palette */

async function openPalette() {
  if (hasModal()) closeModal();
  let results = [];
  let sel = 0;
  const input = h('input', {
    class: 'palette-input',
    placeholder: 'Jump to a title, provider or view…',
    oninput: debounce(async (e) => {
      const q = e.target.value.trim();
      if (!q) { draw(); return; }
      try {
        const res = await api.browse({ q, perPage: 8 });
        results = res.items;
      } catch {
        results = [];
      }
      sel = 0;
      draw();
    }, 160),
    onkeydown: (e) => {
      const items = paletteItems();
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === 'Enter') { items[sel]?.run(); }
    },
  });

  const list = h('div', { class: 'palette-list' });

  function navigationItems() {
    return [
      { label: 'Go to Home', hint: 'g h', run: () => go('#/') },
      { label: 'Go to Browse', hint: 'g b', run: () => go('#/browse') },
      { label: 'Go to Live TV', hint: 'g l', run: () => go('#/live') },
      { label: 'Go to Downloads', hint: 'g d', run: () => go('#/downloads') },
      { label: 'Go to Library', hint: 'g y', run: () => go('#/library') },
      { label: 'Go to Settings', hint: 'g s', run: () => go('#/settings') },
      { label: 'Toggle BDIX network', hint: 'setting', run: async () => { const { settings } = store.get(); await updateSettings({ bdix: !settings.bdix }); toast(`BDIX ${!settings.bdix ? 'reachable' : 'blocked'}.`, 'ok'); renderStatus(); closeModal(); } },
      { label: 'Probe mirrors', hint: 'diagnostic', run: async () => { const res = await api.speedTest(); toast(res.results.map((r) => `${r.provider}: ${r.throughput} · ${r.verdict}`).join('  |  '), 'info', 5200); closeModal(); } },
    ];
  }

  function paletteItems() {
    return [
      ...results.map((item) => ({
        label: `${item.title} (${item.year})`,
        hint: item.kindLabel,
        run: () => go(`#/title/${item.id}`),
      })),
      ...navigationItems().filter((n) => !input.value || n.label.toLowerCase().includes(input.value.toLowerCase())),
    ];
  }

  function draw() {
    const items = paletteItems();
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.replaceChildren(...(items.length ? items.map((item, i) => h('div', {
      class: `palette-item${i === sel ? ' sel' : ''}`,
      onclick: item.run,
      onmouseenter: () => { sel = i; },
    },
    h('span', { class: 'nm' }, item.label),
    h('span', { class: 'k' }, item.hint))) : [h('div', { class: 'palette-item' }, h('span', { class: 'nm muted' }, 'no matches'))]));
  }

  function go(hash) {
    closeModal();
    location.hash = hash;
  }

  draw();
  const m = modal({
    title: 'Command palette',
    subtitle: 'Titles, views and diagnostics',
    size: 'sm',
    body: h('div', {}, h('div', { style: { margin: '-18px -18px 8px' } }, input), list),
  });
  setTimeout(() => input.focus(), 30);
  return m;
}

/* -------------------------------------------------------------- shortcuts */

function bindKeyboard() {
  let gPressed = false;
  let gTimer = null;
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (e.key === 'Escape') { closeModal(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }
    if (typing) return;
    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('global-search')?.focus();
      return;
    }
    if (e.key === '?') { showShortcuts(); return; }
    if (e.key === 'g') {
      gPressed = true;
      clearTimeout(gTimer);
      gTimer = setTimeout(() => { gPressed = false; }, 900);
      return;
    }
    if (gPressed) {
      const route = ROUTES.find((r) => r.key === e.key && !r.hidden);
      if (route) {
        location.hash = route.id === 'home' ? '#/' : `#/${route.id}`;
      }
      gPressed = false;
    }
  });
}

function showShortcuts() {
  const rows = [
    ['/', 'Focus the search field'],
    ['⌘/Ctrl + K', 'Command palette'],
    ['g then h / b / l / d / y / s', 'Home · Browse · Live · Downloads · Library · Settings'],
    ['Enter', 'Open the focused card'],
    ['Esc', 'Close overlays'],
    ['?', 'This sheet'],
  ];
  modal({
    title: 'Keyboard shortcuts',
    subtitle: 'Vim-flavoured, like the terminal client',
    size: 'sm',
    body: h('table', { class: 'table' }, h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('td', { class: 'mono', style: { width: '190px' } }, k), h('td', {}, v))))),
  });
}

function showProfiles() {
  const { profiles, profile } = store.get();
  modal({
    title: 'Who is watching?',
    subtitle: 'Favorites, progress and history are isolated per profile',
    size: 'sm',
    body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
      profiles.map((p) => h('button', {
        class: 'btn wide',
        style: { justifyContent: 'flex-start', height: '46px' },
        onclick: async () => {
          await updateSettings({ currentProfile: p.id });
          toast(`Profile switched to ${p.name}.`, 'ok');
          setTimeout(() => location.reload(), 500);
        },
      },
      h('div', { class: 'avatar', style: { background: p.accent, color: '#0b0b0e' } }, p.name.split(' ').map((w) => w[0]).join('').slice(0, 2)),
      h('span', {}, p.name),
      p.id === profile ? h('span', { class: 'tag ok', style: { marginLeft: 'auto' } }, 'active') : null))),
  });
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
