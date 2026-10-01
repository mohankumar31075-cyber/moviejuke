import { api, store, toast } from '../api.js';
import { h, shelf, sectionHead, stat, panel, svgIcon, fmt } from '../components.js';
import { coverArt } from '../art.js';
import { playFlow, downloadFlow } from '../flows.js';

let heroTimer = null;

export async function render(ctx) {
  const [home, library] = await Promise.all([
    api.home(ctx.profile),
    api.library(ctx.profile).catch(() => ({ resume: [], favorites: [] })),
  ]);

  const root = h('div', {});
  const resumeMap = {};
  (library.resume || []).forEach((r) => {
    if (r.duration) resumeMap[r.titleId] = (r.position / r.duration) * 100;
  });

  // ------------------------------------------------------------ hero deck
  const hero = home.hero[0];
  const heroArt = h('img', { alt: '' });
  const heroTitle = h('div', { class: 'hero-title' });
  const heroMeta = h('div', { class: 'hero-meta' });
  const heroSyn = h('div', { class: 'hero-syn clamp-3' });
  const dots = h('div', { class: 'hero-dots' });
  const progressBar = h('div', { class: 'hero-progress' });
  let index = 0;

  function paintHero(i) {
    index = (i + home.hero.length) % home.hero.length;
    const item = home.hero[index];
    heroArt.src = coverArt(item, { wide: true });
    heroTitle.textContent = item.title;
    heroMeta.replaceChildren(
      h('span', { class: 'tag accent' }, item.kindLabel),
      h('span', { class: 'rating' }, `★ ${item.rating} / 10`),
      h('span', { class: 'mono muted' }, `${item.year} · ${item.runtimeLabel}${item.seasons ? ` · ${item.seasons} season${item.seasons > 1 ? 's' : ''}` : ''}`),
      ...(item.badges || []).slice(0, 2).map((b) => h('span', { class: 'tag' }, b)),
    );
    heroSyn.textContent = item.synopsis;
    dots.replaceChildren(...home.hero.map((_, di) => h('button', {
      class: di === index ? 'on' : '',
      'aria-label': `Featured ${di + 1}`,
      onclick: () => { paintHero(di); restartHero(); },
    })));
    // restart the CSS countdown without swapping nodes
    progressBar.style.animation = 'none';
    void progressBar.offsetWidth;
    progressBar.style.animation = '';
  }

  function restartHero() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => paintHero(index + 1), 11000);
  }

  const heroEl = h('section', { class: 'hero' },
    h('div', { class: 'hero-art' }, heroArt),
    h('div', { class: 'hero-scrim' }),
    h('div', { class: 'hero-body' },
      h('div', { class: 'eyebrow' }, 'Featured on Moviejuke · press ⏎ to play'),
      heroTitle, heroMeta, heroSyn,
      h('div', { class: 'hero-actions' },
        h('button', { class: 'btn primary', onclick: () => playFlow(home.hero[index]) }, svgIcon('play', 15), 'Play now'),
        h('button', { class: 'btn', onclick: () => { location.hash = `#/title/${home.hero[index].id}`; } }, svgIcon('layers', 15), 'Details'),
        h('button', { class: 'btn', onclick: () => downloadFlow(home.hero[index]) }, svgIcon('download', 15), 'Download'),
        h('button', { class: 'btn ghost', onclick: () => { location.hash = '#/browse'; } }, 'Browse all'))),
    dots,
    progressBar,
  );
  paintHero(0);
  restartHero();

  // --------------------------------------------------------------- strips
  const quickStats = h('div', { class: 'stat-strip' },
    stat(String(home.stats.titles), 'titles indexed'),
    stat(String(home.stats.episodes), 'episodes mapped'),
    stat(String(home.stats.channels), 'live channels'),
    stat(`${home.stats.providers}`, 'native providers'),
    stat('0', 'DNS leaks'));

  root.append(heroEl);

  if ((library.resume || []).length) {
    root.append(shelf({
      title: 'Continue watching',
      subtitle: 'Resume where the last session stopped',
      items: library.resume.slice(0, 12).map((r) => ({ ...r.item, synopsis: `${Math.round(r.position / 60)} min watched of ${Math.round(r.duration / 60)} min` })),
      progressMap: resumeMap,
      onOpen: () => {},
    }, 0));
  }

  root.append(sectionHead('Index health', 'Deterministic engine · zero third-party runtime dependencies'));
  root.append(quickStats);

  root.append(shelf({
    title: 'Live now',
    subtitle: 'M3U + EPG · 24h rolling guide',
    items: (home.liveNow || []).slice(0, 12).map(channelToCard),
    onOpen: (item) => { if (item.live) location.hash = `#/live?channel=${item.id}`; },
  }, 1));

  home.rows.forEach((row, i) => {
    root.append(shelf({
      title: row.title,
      subtitle: row.subtitle,
      items: row.items,
      progressMap: resumeMap,
      ranked: row.id === 'trending',
    }, i + 2));
  });

  // -------------------------------------------------------- provider panel
  const speedBody = h('div', { class: 'mono muted', style: { fontSize: '12px' } }, 'Run a probe to compare mirror throughput.');
  root.append(sectionHead('Provider matrix', 'What Moviejuke can reach from this session'));
  root.append(h('div', { class: 'grid cols-2' },
    panel('Native providers',
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        (home.providers || []).map((p) => h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          h('span', { class: 'dot' }),
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('b', {}, p.name),
            h('div', { class: 'mono muted', style: { fontSize: '11px' } }, `${p.transport} · ${p.note}`)),
          h('span', { class: 'tag' }, p.maxQuality)))),
    ),
    panel('Mirror probe',
      h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' } },
        h('button', { class: 'btn sm', onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = 'Probing…';
          try {
            const res = await api.speedTest();
            speedBody.replaceChildren(h('table', { class: 'table' },
              h('thead', {}, h('tr', {}, h('th', {}, 'Mirror'), h('th', {}, 'Latency'), h('th', {}, 'Throughput'), h('th', {}, 'Verdict'))),
              h('tbody', {}, res.results.map((r) => h('tr', {},
                h('td', {}, `${r.provider}`, h('div', { class: 'mono muted', style: { fontSize: '10px' } }, r.mirror)),
                h('td', { class: 'num' }, `${r.latencyMs} ms`),
                h('td', { class: 'num' }, r.throughput),
                h('td', {}, h('span', { class: `tag ${r.verdict === 'Ready' ? 'ok' : 'warn'}` }, r.verdict)))))));
          } catch (err) {
            toast(err.message, 'err');
          } finally {
            btn.disabled = false;
            btn.textContent = 'Probe mirrors';
          }
        } }, svgIcon('signal', 14), 'Probe mirrors'),
        h('button', { class: 'btn sm ghost', onclick: () => { location.hash = '#/settings'; } }, svgIcon('gear', 14), 'Settings')),
      speedBody,
    )));

  // -------------------------------------------------------- latest releases
  root.append(h('footer', { class: 'footer' },
    h('span', {}, `Moviejuke v${store.get().meta?.version || '1.0.0'}`),
    h('span', {}, '· deterministic demo engine ·'),
    h('a', { href: '#/settings' }, 'theme'),
    h('a', { href: '#/downloads' }, 'downloads'),
    h('a', { href: '#/live' }, 'live tv')));

  return root;
}

export function teardown() {
  clearInterval(heroTimer);
}

function channelToCard(ch) {
  return {
    id: ch.id,
    title: ch.name,
    year: 'LIVE',
    kind: 'm',
    kindLabel: ch.category,
    rating: ch.now.rating,
    runtimeLabel: `${ch.now.startLabel}–${ch.now.endLabel}`,
    genres: [ch.category],
    accent: ch.accent,
    badges: [ch.quality, ch.language],
    synopsis: `Now: ${ch.now.title} — next: ${ch.next.title}. ${fmt.num(ch.viewers)} viewers · ${ch.bitrate}.`,
    live: true,
  };
}
