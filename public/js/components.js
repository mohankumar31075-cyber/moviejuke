/** Shared UI primitives: hyperscript, cards, shelves, modals, toasts, player. */

import { icon, coverArt } from './art.js';
import { store, toast } from './api.js';

/* -- hyperscript ---------------------------------------------------------- */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') el.value = value;
    else el.setAttribute(key, value === true ? '' : value);
  });
  append(el, children);
  return el;
}

export function append(el, children) {
  children.flat(4).forEach((child) => {
    if (child === null || child === undefined || child === false || child === true) return;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  });
}

export const frag = (...children) => {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
};

export function svgIcon(name, size = 16) {
  const span = document.createElement('span');
  span.style.display = 'inline-flex';
  span.innerHTML = icon(name, size);
  return span;
}

/* -- formatting ----------------------------------------------------------- */

export const fmt = {
  num(n) {
    if (!Number.isFinite(n)) return '—';
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(Math.round(n));
  },
  time(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '—';
    const s = Math.round(sec);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (v) => String(v).padStart(2, '0');
    return hrs ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
  },
  eta(sec) {
    if (sec === null || sec === undefined) return '—';
    if (sec <= 0) return 'done';
    if (sec < 60) return `${Math.round(sec)}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  },
  gb(n, digits = 2) {
    const v = Number(n) || 0;
    return v >= 10 ? `${v.toFixed(1)} GB` : `${v.toFixed(digits)} GB`;
  },
  pct(n) {
    return `${Math.max(0, Math.min(100, Number(n) || 0)).toFixed(1)}%`;
  },
  bytesFromGb(gb) {
    return `${(Number(gb) * 1024).toFixed(0)} MB`;
  },
};

/* -- cards ---------------------------------------------------------------- */

export function posterCard(item, opts = {}) {
  const art = coverArt(item);
  const progress = opts.progress;
  const card = h('article', {
    class: 'card',
    tabindex: '0',
    role: 'link',
    'aria-label': `${item.title} (${item.year})`,
    onclick: (e) => {
      if (e.target.closest('.mini-btn')) return;
      opts.onOpen ? opts.onOpen(item) : (location.hash = `#/title/${item.id}`);
    },
    onkeydown: (e) => {
      if (e.key === 'Enter') (opts.onOpen ? opts.onOpen(item) : (location.hash = `#/title/${item.id}`));
    },
  },
  h('div', { class: 'poster' },
    h('img', { src: art, alt: '', loading: 'lazy', decoding: 'async' }),
    h('div', { class: 'poster-grad' }),
    h('div', { class: 'poster-type' },
      h('span', { class: 'tag accent' }, item.kindLabel || 'Movie'),
      (item.badges || []).slice(0, 1).map((b) => h('span', { class: 'tag' }, b))),
    h('div', { class: 'poster-score' }, `★ ${item.rating}`),
    opts.rank ? h('div', { class: 'rank-badge' }, String(opts.rank)) : null,
    h('div', { class: 'poster-foot' },
      h('div', { class: 'poster-title clamp-2' }, item.title),
      h('div', { class: 'poster-sub' }, `${item.year} · ${item.runtimeLabel || ''}`)),
    progress ? h('div', { class: 'progress-rail' }, h('i', { style: { width: `${progress}%` } })) : null,
    h('div', { class: 'card-hover' },
      h('div', { class: 'syn clamp-3' }, item.synopsis || ''),
      h('div', { class: 'acts' },
        h('button', { class: 'mini-btn', title: 'Play', onclick: (e) => { e.stopPropagation(); opts.onPlay ? opts.onPlay(item) : (location.hash = `#/title/${item.id}?play=1`); } }, 'Play'),
        h('button', { class: 'mini-btn', title: 'Download', onclick: (e) => { e.stopPropagation(); opts.onDownload ? opts.onDownload(item) : (location.hash = `#/title/${item.id}?tab=streams`); } }, 'Download'),
        h('button', { class: 'mini-btn', title: 'Details', onclick: (e) => { e.stopPropagation(); location.hash = `#/title/${item.id}`; } }, 'Info')))),
  );
  return card;
}

export function shelf({ title, subtitle, items, id, onOpen, onPlay, progressMap, ranked }, index = 0) {
  const scroller = h('div', { class: 'row-scroll', id: id || `shelf-${index}` },
    items.map((item, i) => posterCard(item, {
      onOpen,
      onPlay,
      progress: progressMap ? progressMap[item.id] : undefined,
      rank: ranked && i < 10 ? i + 1 : 0,
    })));
  const wrap = h('div', { class: 'row-wrap' },
    h('div', { class: 'section-head' },
      h('h2', {}, title),
      subtitle ? h('div', { class: 'sub' }, subtitle) : null,
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn xs ghost', onclick: () => { const s = wrap.querySelector('.row-scroll'); s.scrollBy({ left: -s.clientWidth * 0.8, behavior: 'smooth' }); } }, svgIcon('chevL', 14), 'Back'),
      h('button', { class: 'btn xs ghost', onclick: () => { const s = wrap.querySelector('.row-scroll'); s.scrollBy({ left: s.clientWidth * 0.8, behavior: 'smooth' }); } }, 'Next', svgIcon('chevR', 14))),
    scroller,
    h('button', { class: 'row-arrow l', 'aria-label': 'Scroll left', onclick: (e) => { const s = e.currentTarget.parentElement.querySelector('.row-scroll'); s.scrollBy({ left: -s.clientWidth * 0.8, behavior: 'smooth' }); } }, svgIcon('chevL', 15)),
    h('button', { class: 'row-arrow r', 'aria-label': 'Scroll right', onclick: (e) => { const s = e.currentTarget.parentElement.querySelector('.row-scroll'); s.scrollBy({ left: s.clientWidth * 0.8, behavior: 'smooth' }); } }, svgIcon('chevR', 15)),
  );
  return wrap;
}

export function rowCard(item, opts = {}) {
  return h('div', {
    class: 'card card-row',
    onclick: () => (opts.onOpen ? opts.onOpen(item) : (location.hash = `#/title/${item.id}`)),
    style: { cursor: 'pointer' },
  },
  h('div', { class: 'thumb' }, h('img', { src: coverArt(item), alt: '', loading: 'lazy' })),
  h('div', { class: 'body' },
    h('div', { class: 't truncate' }, item.title),
    h('div', { class: 'm' }, opts.meta || `${item.kindLabel} · ${item.year} · ★ ${item.rating}`),
    opts.extra || null),
  opts.action || null);
}

/* -- layout helpers ------------------------------------------------------- */

export function sectionHead(title, subtitle, right) {
  return h('div', { class: 'section-head' },
    h('h2', {}, title),
    subtitle ? h('div', { class: 'sub' }, subtitle) : null,
    h('div', { class: 'spacer' }),
    right || null);
}

export function stat(v, l) {
  return h('div', { class: 'stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
}

export function panel(title, ...children) {
  return h('section', { class: 'panel' },
    title ? h('div', { class: 'panel-head' }, h('h3', {}, title)) : null,
    ...children);
}

export function kv(pairs) {
  return h('dl', { class: 'kv' }, pairs.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
}

export function toggleRow(label, note, on, onChange) {
  return h('div', { class: 'toggle' },
    h('div', { class: 'body' }, h('b', {}, label), note ? h('span', {}, note) : null),
    h('div', { class: `switch${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!on), tabindex: '0', onclick: () => onChange(!on), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!on); } } }, h('i')));
}

export function codeBlock(text) {
  const el = h('pre', { class: 'code' }, h('span', { class: 'cmd' }, text));
  el.addEventListener('click', () => {
    navigator.clipboard?.writeText(text).then(() => toast('Copied command to clipboard.', 'ok', 1800)).catch(() => {});
  });
  el.title = 'Click to copy';
  el.style.cursor = 'copy';
  return el;
}

/* -- modal ---------------------------------------------------------------- */

let openOverlay = null;

export function modal({ title, subtitle, body, footer, size = '', onClose, dismissable = true }) {
  closeModal();
  const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay && dismissable) closeModal(); } },
    h('div', { class: `modal ${size}`, role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('h3', { class: 'truncate' }, title || ''),
          subtitle ? h('div', { class: 'mono muted', style: { fontSize: '11px' } }, subtitle) : null),
        dismissable ? h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, svgIcon('close', 15)) : null),
      h('div', { class: 'modal-body' }, body),
      footer ? h('div', { class: 'modal-foot' }, footer) : null));
  document.body.appendChild(overlay);
  openOverlay = { overlay, onClose };
  return { close: closeModal, el: overlay };
}

export function closeModal() {
  if (!openOverlay) return;
  const { overlay, onClose } = openOverlay;
  overlay.remove();
  openOverlay = null;
  onClose?.();
}

export const hasModal = () => !!openOverlay;

/* -- toasts --------------------------------------------------------------- */

export function mountToasts() {
  const host = h('div', { class: 'toasts', 'aria-live': 'polite' });
  const render = (state) => {
    host.replaceChildren(...state.toasts.map((t) => h('div', { class: `toast ${t.kind}` },
      h('span', { class: 'msg' }, t.message))));
  };
  render(store.get());
  store.subscribe(render);
  document.body.appendChild(host);
  return host;
}

export function skeletonGrid(n = 12) {
  return h('div', { class: 'grid-cards' }, Array.from({ length: n }, () => h('div', { class: 'skeleton poster' })));
}

/* -- player --------------------------------------------------------------- */

/**
 * Playback surface. Tries the real stream URL first (sample CDN); if the
 * network refuses it, falls back to a synthesised visualiser plus a simulated
 * transport so the interaction model stays verifiable offline.
 */
export function playerModal(stream, meta = {}) {
  const video = h('video', {
    class: 'player-video',
    src: stream.url,
    autoplay: '',
    controls: '',
    playsinline: '',
    preload: 'metadata',
  });
  const canvas = h('canvas');
  const fake = h('div', { class: 'player-fake' }, canvas);
  const scrubFill = h('i', { style: { width: '0%' } });
  const timeLabel = h('span', { class: 'time' }, '0:00 / 0:00');
  const status = h('span', { class: 'tag info' }, 'connecting…');
  let mode = 'loading';
  let position = 0;
  let duration = meta.duration || 6420;
  let timer = null;

  const scrub = h('div', { class: 'scrub', onclick: (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    position = duration * ratio;
    if (mode === 'video') video.currentTime = position;
    paint();
  } }, scrubFill);

  function paint() {
    scrubFill.style.width = `${(position / duration) * 100}%`;
    timeLabel.textContent = `${fmt.time(position)} / ${fmt.time(duration)}`;
  }

  function startFake(reason) {
    mode = 'fake';
    video.classList.add('hidden');
    fake.classList.remove('hidden');
    fake.classList.add('crt');
    status.className = 'tag warn';
    status.textContent = reason || 'simulated transport';
    drawVisualiser(canvas, stream);
    clearInterval(timer);
    timer = setInterval(() => {
      position = Math.min(duration, position + 1);
      paint();
      if (position >= duration) clearInterval(timer);
    }, 1000);
  }

  video.addEventListener('error', () => startFake('CDN unreachable · simulated transport'));
  video.addEventListener('loadedmetadata', () => {
    mode = 'video';
    duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration;
    status.className = 'tag ok';
    status.textContent = `streaming ${stream.quality}`;
    paint();
  });
  video.addEventListener('timeupdate', () => {
    if (mode === 'video') {
      position = video.currentTime;
      if (Number.isFinite(video.duration)) duration = video.duration;
      paint();
      if (Math.floor(position) % 12 === 0) markProgress();
    }
  });
  setTimeout(() => {
    if (mode === 'loading') startFake('no CDN route from this network · simulated transport');
  }, 3600);

  function markProgress() {
    if (!meta.onProgress) return;
    meta.onProgress({ position, duration, season: meta.season, episode: meta.episode });
  }

  const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
    h('div', { class: 'player-shell' },
      fake, video,
      h('div', { class: 'player-hud' },
        h('div', { class: 'top' },
          h('span', { style: { fontWeight: '650' } }, stream.title),
          h('span', { class: 'muted mono', style: { fontSize: '11px' } }, stream.subtitle || ''),
          h('div', { class: 'spacer' }),
          status,
          h('span', { class: 'tag' }, stream.provider),
          h('span', { class: 'tag' }, stream.quality)),
        h('div', { class: 'player-controls' },
          h('button', { class: 'icon-btn', 'aria-label': 'Play/Pause', onclick: () => {
            if (mode === 'video') { try { video.paused ? video.play() : video.pause(); } catch { /* ignore */ } }
            else if (timer) { clearInterval(timer); timer = null; status.className = 'tag warn'; status.textContent = 'paused'; }
            else { startFake('simulated transport'); }
          } }, svgIcon('pause', 15)),
          scrub,
          timeLabel,
          h('button', { class: 'icon-btn', 'aria-label': 'Restart', onclick: () => { position = 0; if (mode === 'video') video.currentTime = 0; paint(); } }, svgIcon('refresh', 15))))),
    renderStreamStrip(stream),
  );

  const m = modal({
    title: 'Playback',
    subtitle: `${stream.releaseName}`,
    size: 'lg',
    body,
    footer: [
      h('div', { class: 'mono muted', style: { marginRight: 'auto', fontSize: '11px' } }, `${stream.delivery} · ${stream.size} · ${stream.audio}${stream.hdr ? ` · ${stream.hdr}` : ''}`),
      h('button', { class: 'btn sm', onclick: () => { location.hash = '#/downloads'; closeModal(); } }, svgIcon('download', 14), 'Download this release'),
    ],
    onClose: () => { clearInterval(timer); try { video.pause(); } catch { /* noop */ } markProgress(); },
  });
  return m;
}

function renderStreamStrip(stream) {
  const subs = (stream.subtitles || []).slice(0, 5);
  return h('div', { class: 'grid cols-2' },
    h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h3', {}, 'Live transport')), 
      h('div', { class: 'mono', style: { fontSize: '11.5px', lineHeight: '1.9', color: 'var(--text-2)', wordBreak: 'break-all' } },
        h('div', {}, `GET ${stream.url.split('#')[0]}`),
        h('div', {}, `referer: ${stream.headers.Referer}`),
        h('div', {}, `latency: ${stream.latencyMs} ms · expires: ${new Date(stream.expiresAt).toLocaleTimeString()}`),
        h('div', {}, `mode: ${stream.transport}${stream.seeders ? ` · ${stream.seeders} seeders` : ''}`))),
    h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h3', {}, 'Subtitle tracks')),
      subs.length
        ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }, subs.map((s) => h('span', { class: 'chip static' }, `${s.lang}${s.hi ? ' · HI' : ''} · ${s.format}`)))
        : h('div', { class: 'muted' }, 'No subtitle tracks published for this release.')),
  );
}

function drawVisualiser(canvas, stream) {
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  };
  resize();
  window.addEventListener('resize', resize);
  let t = 0;
  const seed = (stream.token || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars = 56;

  function frame() {
    if (!canvas.isConnected) return;
    t += 0.02;
    const { width: W, height: H } = canvas;
    ctx.fillStyle = 'rgba(4,5,9,0.42)';
    ctx.fillRect(0, 0, W, H);
    const hue = 330 + Math.sin(t * 0.3) * 40 + (seed % 40);
    for (let i = 0; i < bars; i += 1) {
      const phase = Math.sin(t * 1.6 + i * 0.35) * 0.5 + Math.sin(t * 0.7 + i * 0.11) * 0.5;
      const amp = (0.12 + Math.abs(phase) * 0.78) * H * 0.5;
      const x = (i / bars) * W;
      const w = W / bars - 2 * dpr;
      ctx.fillStyle = `hsla(${hue + i * 1.4}, 78%, ${46 + amp / H * 30}%, 0.75)`;
      ctx.fillRect(x, H / 2 - amp / 2, w, amp);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 26 * dpr) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => window.removeEventListener('resize', resize);
}
