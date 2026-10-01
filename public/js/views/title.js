import { api, store, toast } from '../api.js';
import { h, posterCard, kv, panel, svgIcon, fmt } from '../components.js';
import { coverArt } from '../art.js';
import { playFlow, downloadFlow, resolveAndPlay } from '../flows.js';

export async function render(ctx) {
  const { profile, settings } = store.get();
  const detail = await api.title(ctx.params.id, profile);
  const root = h('div', {});

  const enabled = (p) => settings?.providers?.[p.id] !== false;
  const providerReady = detail.providers.filter((p) => p.available && enabled(p));

  // ------------------------------------------------------------- hero band
  const heroBand = h('section', { class: 'title-hero' },
    h('div', { class: 'art' }, h('img', { src: coverArt(detail, { wide: true }), alt: '' })),
    h('div', { class: 'scrim' }),
    h('div', { class: 'inner' },
      h('div', { class: 'title-poster' }, h('img', { src: coverArt(detail), alt: detail.title })),
      h('div', { class: 'title-main' },
        h('div', { class: 'eyebrow' }, `${detail.kindLabel} · ${detail.collection}`),
        h('h1', { class: 'title-name' }, detail.title),
        h('div', { class: 'title-tagline' }, `“${detail.tagline}”`),
        h('div', { class: 'title-facts' },
          h('span', { class: 'rating' }, `★ ${detail.rating} / 10`),
          h('span', { class: 'mono' }, String(detail.year)),
          h('span', { class: 'mono' }, detail.runtimeLabel),
          detail.seasons ? h('span', { class: 'mono' }, `${detail.seasons} season${detail.seasons > 1 ? 's' : ''} · ${detail.seasonsDetail.reduce((n, b) => n + b.count, 0)} episodes`) : null,
          h('span', { class: 'mono' }, `${fmt.num(detail.votes)} votes`),
          ...detail.badges.map((b) => h('span', { class: 'tag accent' }, b))),
        h('div', { class: 'hero-actions' },
          h('button', { class: 'btn primary', onclick: () => playFlow(detail) }, svgIcon('play', 15), 'Play'),
          h('button', { class: 'btn', onclick: () => downloadFlow(detail) }, svgIcon('download', 15), 'Download'),
          favButton(detail, profile),
          h('button', { class: 'btn ghost', onclick: () => { location.hash = `#/browse?genre=${encodeURIComponent(detail.genres[0] || '')}`; } }, svgIcon('grid', 15), detail.genres[0]),
          detail.progress ? h('span', { class: 'tag info' }, `resume at ${fmt.time(detail.progress.position)}`) : null),
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' } },
          h('span', { class: `tag ${providerReady.length ? 'ok' : 'err'}` }, `${providerReady.length}/${detail.providers.length} providers ready`),
          h('span', { class: 'tag' }, `${detail.releases.length} releases`),
          h('span', { class: 'tag' }, detail.totalSize),
          h('span', { class: 'tag' }, `${detail.subtitles.length} subtitle tracks`)))));
  root.append(heroBand);

  // ---------------------------------------------------------------- tabs
  const tabHost = h('div', {});
  const defs = [
    { id: 'overview', label: 'Overview' },
    ...(detail.kind === 'm' ? [] : [{ id: 'episodes', label: `Episodes (${detail.seasonsDetail.reduce((n, b) => n + b.count, 0)})` }]),
    { id: 'streams', label: `Streams (${detail.releases.length})` },
    { id: 'subtitles', label: `Subtitles (${detail.subtitles.length})` },
    { id: 'similar', label: 'Similar' },
  ];
  const initial = ctx.query.get('tab') || 'overview';

  const tabs = h('div', { class: 'tabs' }, defs.map((d) => h('button', {
    class: d.id === initial ? 'on' : '',
    onclick: (e) => {
      e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
      e.currentTarget.classList.add('on');
      tabHost.replaceChildren(buildTab(d.id, detail, ctx));
    },
  }, d.label)));

  root.append(tabs, tabHost);
  tabHost.append(buildTab(defs.some((d) => d.id === initial) ? initial : 'overview', detail, ctx));

  if (ctx.query.get('play') === '1') {
    setTimeout(() => playFlow(detail), 120);
  }
  return root;
}

function favButton(detail, profile) {
  let on = !!detail.favorite;
  const btn = h('button', {
    class: `btn${on ? ' primary' : ''}`,
    onclick: async () => {
      try {
        await api.libraryAction(profile, { action: 'favorite', titleId: detail.id });
        on = !on;
        btn.classList.toggle('primary', on);
        btn.replaceChildren(svgIcon('heart', 15), document.createTextNode(on ? 'Favorited' : 'Favorite'));
        toast(on ? 'Added to favorites.' : 'Removed from favorites.', 'ok', 1700);
      } catch (err) {
        toast(err.message, 'err');
      }
    },
  }, svgIcon('heart', 15), on ? 'Favorited' : 'Favorite');
  return btn;
}

function buildTab(id, detail, ctx) {
  if (id === 'episodes') return episodesTab(detail);
  if (id === 'streams') return streamsTab(detail);
  if (id === 'subtitles') return subtitlesTab(detail);
  if (id === 'similar') return similarTab(detail);
  return overviewTab(detail);
}

/* ------------------------------------------------------------------ tabs */

function overviewTab(detail) {
  const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');

  const castCard = (name, i) => h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
    h('div', { class: 'avatar', style: { background: detail.accent, opacity: String(1 - i * 0.09), color: '#0b0b0e' } }, initials(name)),
    h('div', { style: { minWidth: '0' } },
      h('div', { class: 'truncate', style: { fontSize: '13px', fontWeight: '600' } }, name),
      h('div', { class: 'mono muted', style: { fontSize: '10.5px' } }, i === 0 ? 'lead' : i < 3 ? 'supporting' : 'ensemble')));

  const providerRow = (p) => h('tr', {},
    h('td', {}, h('b', {}, p.name), h('div', { class: 'mono muted', style: { fontSize: '10.5px' } }, p.region)),
    h('td', { class: 'mono' }, p.transport),
    h('td', { class: 'num' }, p.available ? String(p.count) : '—'),
    h('td', {}, p.available
      ? h('span', { class: 'tag ok' }, `ready · ${p.bestQuality}`)
      : h('span', { class: 'tag err', title: p.error }, p.error)));

  const synopsis = panel('Synopsis',
    h('p', { style: { margin: '0 0 12px', color: 'var(--text-2)' } }, detail.synopsis),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      detail.genres.map((g) => h('span', { class: 'chip static' }, g)),
      detail.languages.map((l) => h('span', { class: 'chip static' }, `🌐 ${l}`))));

  const cast = panel('Cast',
    h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' } },
      detail.cast.map(castCard)));

  const providerTable = h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Provider'), h('th', {}, 'Transport'), h('th', {}, 'Releases'), h('th', {}, 'Status'))),
    h('tbody', {}, detail.providers.map(providerRow)));

  const left = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
    synopsis, cast, panel('Provider availability', providerTable));

  const details = panel('Details', kv([
    ['Director', detail.director],
    ['Released', detail.year],
    ['Indexed', detail.addedAt],
    ['Runtime', detail.runtimeLabel],
    ['Rating', `${detail.rating} / 10`],
    ['Votes', fmt.num(detail.votes)],
    ['Total size', detail.totalSize],
    ['Accent', h('span', { class: 'mono' }, detail.accent)],
  ]));

  const quick = panel('Quick actions',
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
      h('button', { class: 'btn wide primary', onclick: () => playFlow(detail) }, svgIcon('play', 15), 'Play with provider picker'),
      h('button', { class: 'btn wide', onclick: () => downloadFlow(detail) }, svgIcon('download', 15), 'Queue download'),
      h('button', { class: 'btn wide ghost', onclick: copyLink(detail) }, svgIcon('copy', 15), 'Copy share link')));

  const right = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, details, quick);

  return h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)' } }, left, right);
}

function copyLink(detail) {
  const url = `${location.origin}/#/title/${detail.id}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => toast('Link copied.', 'ok', 1600)).catch(() => toast(url, 'info', 5000));
  } else {
    toast(url, 'info', 5000);
  }
}

function episodesTab(detail) {
  const host = h('div', {});
  let season = detail.seasonsDetail[0]?.season || 1;

  const seasonRow = h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '16px' } });
  const list = h('div', {});

  function draw() {
    seasonRow.replaceChildren(...detail.seasonsDetail.map((b) => h('button', {
      class: `chip${b.season === season ? ' active' : ''}`,
      onclick: () => { season = b.season; draw(); },
    }, `Season ${b.season}`, h('span', { class: 'mono muted', style: { fontSize: '10px' } }, `${b.count} eps`))));
    const block = detail.seasonsDetail.find((b) => b.season === season);
    list.replaceChildren(...(block ? block.episodes : []).map((ep) => h('div', { class: 'episode' },
      h('div', { class: 'code' }, ep.code),
      h('div', {},
        h('div', { class: 't' }, ep.title),
        h('div', { class: 's clamp-2' }, ep.synopsis),
        h('div', { class: 'mono muted', style: { fontSize: '10.5px', marginTop: '4px' } }, `${ep.airDate} · ${ep.runtime} min · ★ ${ep.rating}`)),
      h('div', { style: { display: 'flex', gap: '7px' } },
        h('button', { class: 'btn xs', onclick: () => playFlow(detail, { season: ep.season, episode: ep.episode }) }, svgIcon('play', 13), 'Play'),
        h('button', { class: 'btn xs ghost', onclick: () => downloadFlow(detail, { season: ep.season }) }, svgIcon('download', 13))))));
  }
  draw();

  host.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
    seasonRow,
    h('div', { class: 'spacer' }),
    h('button', { class: 'btn sm', onclick: () => downloadFlow(detail, { season }) }, svgIcon('download', 14), `Download season ${season}`)),
    list);
  return host;
}

function streamsTab(detail) {
  const host = h('div', {});
  const body = h('div', {});
  let providerFilter = 'all';
  let qualityFilter = 'all';

  const bar = h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '14px' } });

  function draw() {
    const providers = ['all', ...new Set(detail.releases.map((r) => r.providerId))];
    const qualities = ['all', ...new Set(detail.releases.map((r) => r.quality))];
    bar.replaceChildren(
      ...providers.map((p) => h('button', { class: `chip${providerFilter === p ? ' active' : ''}`, onclick: () => { providerFilter = p; draw(); } },
        p === 'all' ? 'All providers' : detail.providers.find((x) => x.id === p)?.name || p)),
      h('span', { style: { width: '1px', background: 'var(--line)', margin: '0 4px' } }),
      ...qualities.map((q) => h('button', { class: `chip${qualityFilter === q ? ' active' : ''}`, onclick: () => { qualityFilter = q; draw(); } },
        q === 'all' ? 'Any quality' : q)));

    const rows = detail.releases
      .filter((r) => providerFilter === 'all' || r.providerId === providerFilter)
      .filter((r) => qualityFilter === 'all' || r.quality === qualityFilter);

    body.replaceChildren(rows.length
      ? h('table', { class: 'table' },
        h('thead', {}, h('tr', {},
          h('th', {}, 'Release'), h('th', {}, 'Provider'), h('th', {}, 'Q'), h('th', {}, 'Size'),
          h('th', {}, 'Audio'), h('th', {}, 'Links'), h('th', {}, ''))),
        h('tbody', {}, rows.map((r) => h('tr', {},
          h('td', { style: { maxWidth: '360px' } },
            h('div', { class: 'truncate mono', style: { fontSize: '11.5px' } }, r.name),
            h('div', { class: 'mono muted', style: { fontSize: '10.5px' } }, `${r.released} · score ${r.score}${r.seeders ? ` · ${r.seeders} seeders` : ''}${r.multiConnection ? ' · multi-conn' : ''}`)),
          h('td', {}, h('span', { class: 'tag' }, r.provider)),
          h('td', {}, h('span', { class: 'tag accent' }, r.quality)),
          h('td', { class: 'num' }, r.size),
          h('td', { class: 'mono', style: { fontSize: '11px' } }, `${r.audio}${r.hdr ? ` · ${r.hdr}` : ''}`),
          h('td', { class: 'num' }, `${r.latencyMs} ms`),
          h('td', { style: { whiteSpace: 'nowrap' } },
            h('button', { class: 'btn xs', onclick: () => {
              resolveAndPlay(detail, { providerId: r.providerId, quality: r.quality, season: 1, episode: 1 });
            } }, 'Resolve'),
            ' ',
            h('button', { class: 'btn xs ghost', title: 'copy release name', onclick: () => { navigator.clipboard?.writeText(r.name); toast('Release name copied.', 'ok', 1500); } }, svgIcon('copy', 12)))))))
      : h('div', { class: 'empty' }, h('div', { class: 'big' }, '∅'), h('div', {}, 'No releases for this filter.')));
  }
  draw();

  host.append(h('div', { class: 'panel', style: { marginBottom: '16px' } },
    h('div', { class: 'mono muted', style: { fontSize: '11.5px' } },
      `Resolution strategy: playback prefers seekable multi-connection CDNs; downloads may use single-use workers. Provider errors are surfaced verbatim from the resolver.`)),
    bar, body);
  return host;
}

function subtitlesTab(detail) {
  return h('div', { class: 'panel' },
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Language'), h('th', {}, 'Code'), h('th', {}, 'Format'), h('th', {}, 'Size'), h('th', {}, 'Flags'), h('th', {}, ''))),
      h('tbody', {}, detail.subtitles.map((s) => h('tr', {},
        h('td', {}, s.lang),
        h('td', { class: 'mono' }, s.code),
        h('td', { class: 'mono' }, s.format),
        h('td', { class: 'num' }, s.size),
        h('td', {}, s.hi ? h('span', { class: 'tag warn' }, 'hearing impaired') : h('span', { class: 'tag' }, 'full')),
        h('td', {}, h('button', { class: 'btn xs', onclick: () => toast(`${s.lang} subtitle queued to ~/Subtitles/Moviejuke/${detail.id}.${s.code}.${s.format.toLowerCase()}`, 'ok', 3200) }, svgIcon('download', 12), 'Save')))))),
    h('div', { class: 'mono muted', style: { fontSize: '11px', marginTop: '10px' } },
      'Subtitle extraction runs against the resolved release, so the picker is only accurate after a stream resolves.'));
}

function similarTab(detail) {
  if (!detail.similar?.length) return h('div', { class: 'empty' }, h('div', {}, 'Nothing similar in the index.'));
  return h('div', { class: 'grid-cards' }, detail.similar.map((s) => posterCard(s)));
}
