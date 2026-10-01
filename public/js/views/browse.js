import { api } from '../api.js';
import { h, posterCard, sectionHead, skeletonGrid, svgIcon } from '../components.js';
import { playFlow, downloadFlow } from '../flows.js';

export async function render(ctx) {
  const q = Object.fromEntries(ctx.query.entries());
  const filters = {
    q: q.q || '',
    kind: q.kind || 'all',
    genre: q.genre || 'all',
    language: q.language || 'all',
    year: q.year || 'all',
    minRating: Number(q.minRating || 0),
    sort: q.sort || (q.q ? 'relevance' : 'popularity'),
    page: Number(q.page || 1),
  };

  const root = h('div', {});
  const resultHost = h('div', {});
  const countLabel = h('div', { class: 'mono muted', style: { fontSize: '12px' } });
  let meta = ctx.meta;
  const facets = meta.facets;

  function navigate(patch) {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== 'all' && !(k === 'minRating' && Number(v) === 0) && !(k === 'page' && Number(v) === 1)) params.set(k, v);
    });
    location.hash = `#/browse${params.toString() ? `?${params}` : ''}`;
  }

  // ------------------------------------------------------------ filter bar
  const kindRow = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px' } },
    facets.kinds.map((k) => h('button', {
      class: `chip${filters.kind === k.id ? ' active' : ''}`,
      onclick: () => navigate({ kind: k.id, page: 1 }),
    }, k.label)));

  const searchInput = h('input', {
    type: 'text',
    value: filters.q,
    placeholder: 'Search titles, cast, directors, genres…',
    onkeydown: (e) => { if (e.key === 'Enter') navigate({ q: e.target.value, page: 1 }); },
  });

  const selects = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' } },
    selectField('Genre', filters.genre, [{ v: 'all', l: 'All genres' }, ...facets.genres.map((g) => ({ v: g, l: g }))], (v) => navigate({ genre: v, page: 1 })),
    selectField('Language', filters.language, [{ v: 'all', l: 'Any language' }, ...facets.languages.map((l) => ({ v: l, l }))], (v) => navigate({ language: v, page: 1 })),
    selectField('Year', filters.year, [{ v: 'all', l: 'Any year' }, ...facets.years.map((y) => ({ v: String(y), l: String(y) }))], (v) => navigate({ year: v, page: 1 })),
    selectField('Sort', filters.sort, [
      { v: 'popularity', l: 'Popularity' }, { v: 'rating', l: 'Rating' }, { v: 'newest', l: 'Newest' },
      { v: 'oldest', l: 'Oldest' }, { v: 'title', l: 'A–Z' }, { v: 'runtime', l: 'Longest' },
    ], (v) => navigate({ sort: v, page: 1 })));

  const ratingRange = h('input', {
    type: 'range', min: '0', max: '9', step: '0.5', value: String(filters.minRating),
    oninput: (e) => { ratingLabel.textContent = `★ ${e.target.value}+`; },
    onchange: (e) => navigate({ minRating: e.target.value, page: 1 }),
  });
  const ratingLabel = h('span', { class: 'mono', style: { fontSize: '12px', minWidth: '44px' } }, `★ ${filters.minRating}+`);

  root.append(sectionHead('Browse the index', `${meta.facets.genres.length} genres · ${meta.facets.languages.length} languages · ${meta.facets.years.length} years`),
    h('section', { class: 'panel', style: { marginBottom: '18px' } },
      h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' } },
        h('div', { style: { flex: '1 1 280px' } }, h('div', { class: 'field', style: { marginBottom: '0' } }, h('label', {}, 'Query'), searchInput)),
        h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '8px' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', height: '36px' } }, ratingRange, ratingLabel),
          h('button', { class: 'btn sm', onclick: () => navigate({ q: searchInput.value, page: 1 }) }, svgIcon('search', 14), 'Search'),
          h('button', { class: 'btn sm ghost', onclick: () => { location.hash = '#/browse'; } }, 'Reset'))),
      kindRow,
      h('div', { style: { marginTop: '14px' } }, selects)));

  root.append(h('div', { class: 'section-head' }, h('h2', {}, 'Results'), countLabel));
  root.append(resultHost);
  resultHost.append(skeletonGrid(12));

  const params = {
    ...filters,
    sort: filters.sort === 'relevance' ? '' : filters.sort,
    perPage: 24,
  };

  api.browse(params).then((res) => {
    countLabel.textContent = `${res.total} title${res.total === 1 ? '' : 's'} · page ${res.page} of ${res.pages}`;
    if (!res.items.length) {
      resultHost.replaceChildren(h('div', { class: 'empty' },
        h('div', { class: 'big' }, '∅'),
        h('div', {}, 'No results found.'),
        h('div', { class: 'mono muted', style: { fontSize: '12px', marginTop: '6px' } }, 'Try a broader query, or clear the rating floor.')));
      return;
    }
    resultHost.replaceChildren(h('div', { class: 'grid-cards' },
      res.items.map((item) => posterCard(item, {
        onPlay: (it) => playFlow(it),
        onDownload: (it) => downloadFlow(it),
      }))));

    const pages = [];
    const windowSize = 2;
    for (let p = 1; p <= res.pages; p += 1) {
      if (p === 1 || p === res.pages || Math.abs(p - res.page) <= windowSize) pages.push(p);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    resultHost.append(h('div', { style: { display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '24px', flexWrap: 'wrap' } },
      h('button', { class: 'btn sm ghost', disabled: res.page === 1 ? '' : null, onclick: () => navigate({ page: res.page - 1 }) }, svgIcon('chevL', 14)),
      pages.map((p) => (p === '…'
        ? h('span', { class: 'mono muted', style: { alignSelf: 'center' } }, '…')
        : h('button', { class: `btn sm${p === res.page ? ' primary' : ' ghost'}`, onclick: () => { navigate({ page: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, String(p)))),
      h('button', { class: 'btn sm ghost', disabled: res.page === res.pages ? '' : null, onclick: () => { navigate({ page: res.page + 1 }); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, svgIcon('chevR', 14))));
  }).catch((err) => {
    resultHost.replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'big' }, '!'), h('div', {}, err.message)));
  });

  return root;
}

function selectField(label, value, options, onChange) {
  return h('div', { class: 'field', style: { marginBottom: '0' } },
    h('label', {}, label),
    h('select', { onchange: (e) => onChange(e.target.value) },
      options.map((o) => h('option', { value: o.v, selected: String(o.v) === String(value) ? '' : null }, o.l))));
}
