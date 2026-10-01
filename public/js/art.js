/**
 * Procedural cover art.
 *
 * Every title gets a deterministic, generated poster/backdrop built from its
 * accent colour and a seeded PRNG — no external image hosts, no broken
 * thumbnails, and the same title always renders the same art.
 */

function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KIND_GLYPH = { m: 'FILM', s: 'SERIES', a: 'ANIME', d: 'DRAMA' };

function hexToRgb(hex) {
  const clean = (hex || '#e11d48').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(hex, target, amount) {
  const { r, g, b } = hexToRgb(hex);
  const t = hexToRgb(target);
  const m = (a, c) => Math.round(a + (c - a) * amount);
  return `rgb(${m(r, t.r)},${m(g, t.g)},${m(b, t.b)})`;
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * @param {object} item  catalogue card ({ id, title, accent, kind, year, rating })
 * @param {object} opts  { wide?: boolean, w?: number, h?: number }
 * @returns {string} data URI
 */
export function coverArt(item, opts = {}) {
  const wide = !!opts.wide;
  const w = opts.w || (wide ? 1280 : 600);
  const h = opts.h || (wide ? 720 : 900);
  const rnd = makeRng(seedFrom(String(item.id || item.title || 'moviejuke')));
  const accent = item.accent || '#e11d48';
  const accent2 = mix(accent, '#38bdf8', 0.45 + rnd() * 0.35);
  const deep = mix(accent, '#05060a', 0.86);
  const angle = Math.round(rnd() * 90 - 45);

  const shapes = [];
  const shapeCount = wide ? 7 : 5;
  for (let i = 0; i < shapeCount; i += 1) {
    const kind = rnd();
    const cx = rnd() * w;
    const cy = rnd() * h * (wide ? 1 : 1.05);
    const size = (0.18 + rnd() * 0.5) * (wide ? w : w) * 0.75;
    const op = 0.1 + rnd() * 0.3;
    if (kind < 0.34) {
      shapes.push(`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${size.toFixed(0)}" fill="${rgba(i % 2 ? accent : accent2, op)}"/>`);
    } else if (kind < 0.66) {
      const rot = (rnd() * 90 - 45).toFixed(1);
      shapes.push(`<rect x="${(cx - size / 2).toFixed(0)}" y="${(cy - size / 3).toFixed(0)}" width="${size.toFixed(0)}" height="${(size * 0.66).toFixed(0)}" rx="${(size * 0.06).toFixed(0)}" fill="${rgba(i % 2 ? accent2 : accent, op)}" transform="rotate(${rot} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`);
    } else {
      const pts = [];
      const sides = 3 + Math.floor(rnd() * 4);
      for (let s = 0; s < sides; s += 1) {
        const a = (s / sides) * Math.PI * 2 + rnd() * 0.4;
        pts.push(`${(cx + Math.cos(a) * size * 0.5).toFixed(0)},${(cy + Math.sin(a) * size * 0.5).toFixed(0)}`);
      }
      shapes.push(`<polygon points="${pts.join(' ')}" fill="${rgba(accent, op * 0.9)}"/>`);
    }
  }

  const streaks = Array.from({ length: wide ? 5 : 6 }, (_, i) => {
    const x = rnd() * w;
    const sw = 1 + rnd() * 3;
    const op = 0.05 + rnd() * 0.13;
    return `<rect x="${x.toFixed(0)}" y="-60" width="${sw.toFixed(1)}" height="${h + 120}" fill="rgba(255,255,255,${op.toFixed(3)})" transform="rotate(${angle} ${x.toFixed(0)} ${h / 2})"/>`;
  }).join('');

  const ringR = Math.min(w, h) * (0.34 + rnd() * 0.22);
  const cxr = (0.3 + rnd() * 0.4) * w;
  const cyr = (0.3 + rnd() * 0.4) * h;

  const titleSize = wide ? Math.round(w * 0.052) : Math.round(w * 0.098);
  const titleLines = wrapText(String(item.title || '').toUpperCase(), wide ? 22 : 13, 3);
  const titleY = h - (wide ? 120 : 150);
  const titleSvg = titleLines
    .map((line, i) => `<text x="${wide ? 56 : 44}" y="${titleY + i * titleSize * 1.06}" font-family="Inter,Helvetica,Arial,sans-serif" font-size="${titleSize}" font-weight="800" fill="rgba(255,255,255,${0.94 - i * 0.12})" letter-spacing="${(-titleSize * 0.02).toFixed(1)}">${escapeXml(line)}</text>`)
    .join('');

  const metaSvg = `<text x="${wide ? 58 : 46}" y="${wide ? 34 : h - 108}" font-family="ui-monospace,Menlo,monospace" font-size="${wide ? 15 : 20}" fill="rgba(255,255,255,0.62)" letter-spacing="3">${escapeXml(`${KIND_GLYPH[item.kind] || 'FILM'} · ${item.year || ''}`)}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} 0.5 0.5)">
    <stop offset="0%" stop-color="${mix(accent, '#ffffff', 0.06)}"/>
    <stop offset="42%" stop-color="${deep}"/>
    <stop offset="100%" stop-color="${mix(deep, '#000000', 0.55)}"/>
  </linearGradient>
  <radialGradient id="glow" cx="${(rnd() * 100).toFixed(0)}%" cy="${(rnd() * 60).toFixed(0)}%" r="70%">
    <stop offset="0%" stop-color="${rgba(accent2, 0.55)}"/>
    <stop offset="100%" stop-color="${rgba(accent2, 0)}"/>
  </radialGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="45%" stop-color="rgba(0,0,0,0)"/>
    <stop offset="100%" stop-color="rgba(0,0,0,0.82)"/>
  </linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<rect width="${w}" height="${h}" fill="url(#glow)"/>
<g opacity="0.85">${shapes.join('')}</g>
<circle cx="${cxr.toFixed(0)}" cy="${cyr.toFixed(0)}" r="${ringR.toFixed(0)}" fill="none" stroke="${rgba('#ffffff', 0.09)}" stroke-width="${(1 + rnd() * 2).toFixed(1)}"/>
<circle cx="${cxr.toFixed(0)}" cy="${cyr.toFixed(0)}" r="${(ringR * 0.72).toFixed(0)}" fill="none" stroke="${rgba(accent, 0.28)}" stroke-width="1"/>
<g>${streaks}</g>
<rect width="${w}" height="${h}" fill="url(#scrim)"/>
<rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.055"/>
<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="2"/>
${metaSvg}
${titleSvg}
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function wrapText(text, maxChars, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  });
  if (current) lines.push(current.trim());
  return lines.slice(0, maxLines);
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

/** Tiny inline icon set (stroke-based, 1.6px, inherits currentColor). */
export function icon(name, size = 16) {
  const paths = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    play: '<path d="M7 4.5 19 12 7 19.5z"/>',
    download: '<path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/>',
    heart: '<path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7C19 15.6 12 20 12 20z"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10L5.6 18.4"/>',
    tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 21h6"/>',
    home: '<path d="M4 11 12 4l8 7v9H4z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    book: '<path d="M4 5h7v15H4z"/><path d="M13 5h7v15h-7z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 13 4.5 4.5L19 7"/>',
    chevL: '<path d="m14 6-6 6 6 6"/>',
    chevR: '<path d="m10 6 6 6-6 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/>',
    terminal: '<path d="m5 8 3 3-3 3"/><path d="M11 15h5"/><rect x="3" y="4" width="18" height="16" rx="2"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/>',
    layers: '<path d="m12 4 8 4-8 4-8-4z"/><path d="m4 13 8 4 8-4"/>',
    signal: '<path d="M5 18v-4M10 18v-8M15 18V6M20 18v-2"/>',
  };
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}
