/** Cross-view flows: resolve a stream, launch a player, queue a download. */

import { api, store, toast, updateSettings } from './api.js';
import { h, modal, closeModal, playerModal, fmt, svgIcon } from './components.js';

/** Pick a provider + quality, then play. */
export async function playFlow(item, opts = {}) {
  const { profile } = store.get();
  let detail;
  try {
    detail = await api.title(item.id, profile);
  } catch (err) {
    toast(`Cannot load ${item.title}: ${err.message}`, 'err');
    return;
  }

  const settings = store.get().settings || {};
  const enabled = (p) => settings.providers?.[p.id] !== false;
  const available = detail.providers.filter((p) => p.available && enabled(p));
  if (!available.length) {
    toast('No provider could resolve this title.', 'err');
    return;
  }

  let providerId = opts.provider || available[0].id;
  let quality = settings.defaultQuality && settings.defaultQuality !== 'Auto' ? settings.defaultQuality : null;
  let season = opts.season ?? (detail.kind === 'm' ? 0 : 1);
  let episode = opts.episode ?? (detail.kind === 'm' ? 0 : 1);

  const selected = { providerId, quality, season, episode };

  const providerRow = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px' } });
  const ladder = h('div', { class: 'quality-ladder' });
  const episodeRow = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px' } });

  function drawProviders() {
    providerRow.replaceChildren(...detail.providers.map((p) => {
      const blocked = !p.available || !enabled(p);
      return h('button', {
        class: `chip${selected.providerId === p.id ? ' active' : ''}`,
        disabled: blocked ? '' : null,
        style: blocked ? { opacity: '.5', cursor: 'not-allowed' } : {},
        title: p.error || p.note,
        onclick: () => { selected.providerId = p.id; drawProviders(); drawLadder(); },
      },
      h('span', { class: `dot ${blocked ? 'err' : ''}` }),
      p.name,
      h('span', { class: 'mono muted', style: { fontSize: '10px' } }, blocked ? 'blocked' : p.maxQuality));
    }));
  }

  function drawLadder() {
    const rows = [
      { quality: null, size: null, label: 'Auto' },
      ...detail.releases.filter((r) => r.providerId === selected.providerId).map((r) => ({ quality: r.quality, size: r.size, label: r.quality, release: r })),
    ];
    const seen = new Set();
    const unique = rows.filter((r) => {
      const key = r.quality || 'auto';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    ladder.replaceChildren(...unique.map((row) => {
      const on = (selected.quality || null) === row.quality || (!selected.quality && !row.quality);
      return h('div', { class: `quality-opt${on ? ' on' : ''}`, onclick: () => { selected.quality = row.quality; drawLadder(); } },
        h('span', { class: 'badge' }, row.quality === '4K' ? '4K UHD' : (row.quality || 'AUTO')),
        h('div', { class: 'info' },
          h('b', {}, row.quality ? row.release.name.split('.').slice(-4).join(' ') : 'Highest available for this provider'),
          h('span', {}, row.quality ? `${row.size} · ${row.release.audio}${row.release.hdr ? ` · ${row.release.hdr}` : ''} · ${row.release.multiConnection ? 'multi-connection' : 'single stream'}` : `${detail.title} · adaptive bitrate`)),
        on ? svgIcon('check', 16) : null);
    }));
  }

  function drawEpisodes() {
    if (detail.kind === 'm') { episodeRow.replaceChildren(); return; }
    const blocks = detail.seasonsDetail || [];
    const list = [];
    const current = blocks.find((b) => b.season === selected.season) || blocks[0];
    (current ? current.episodes : []).forEach((ep) => list.push(ep));
    episodeRow.replaceChildren(
      ...list.slice(0, 30).map((ep) => h('button', {
        class: `chip${ep.episode === selected.episode ? ' active' : ''}`,
        onclick: () => { selected.episode = ep.episode; drawEpisodes(); },
      }, ep.code, h('span', { class: 'mono muted', style: { fontSize: '10px' } }, ep.title.slice(0, 16)))),
    );
  }

  drawProviders();
  drawLadder();
  drawEpisodes();

  const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } },
    h('div', {},
      h('div', { class: 'eyebrow' }, 'Provider'),
      providerRow,
      h('div', { class: 'mono muted', style: { fontSize: '11px', marginTop: '8px' } }, detail.providers.find((p) => p.id === selected.providerId)?.note || '')),
    detail.kind === 'm' ? null : h('div', {}, h('div', { class: 'eyebrow' }, `Episodes · Season ${selected.season}`), episodeRow),
    h('div', {}, h('div', { class: 'eyebrow' }, 'Quality ladder'), ladder),
    h('div', { class: 'mono muted', style: { fontSize: '11px' } }, 'Resolution is simulated locally: the demo resolves to a public sample stream because no provider CDN is reachable from a sandbox.'),
  );

  modal({
    title: `Play ${detail.title}`,
    subtitle: `${detail.year} · ${detail.kindLabel} · ${detail.providers.filter((p) => p.available).length}/${detail.providers.length} providers ready`,
    body,
    footer: [
      h('button', { class: 'btn sm ghost', onclick: () => closeModal() }, 'Cancel'),
      h('button', {
        class: 'btn sm',
        onclick: async () => {
          closeModal();
          await resolveAndPlay(detail, selected);
        },
      }, svgIcon('download', 14), 'Queue download'),
      h('button', {
        class: 'btn sm primary',
        onclick: async () => {
          closeModal();
          await resolveAndPlay(detail, selected);
        },
      }, svgIcon('play', 14), 'Resolve & play'),
    ],
  });
}

export async function resolveAndPlay(detail, selected) {
  const { profile } = store.get();
  toast(`Resolving ${detail.title} via ${providerName(selected.providerId)}…`, 'info', 2200);
  try {
    const stream = await api.stream({
      title: detail.id,
      provider: selected.providerId,
      quality: selected.quality || 'Auto',
      season: selected.season,
      episode: selected.episode,
    });
    api.launch().catch(() => {});
    playerModal(stream, {
      season: selected.season,
      episode: selected.episode,
      duration: detail.kind === 'm' ? detail.runtime * 60 : 2400,
      onProgress: (p) => {
        api.libraryAction(profile, { action: 'progress', titleId: detail.id, ...p }).catch(() => {});
      },
    });
  } catch (err) {
    showResolverFailure(detail, selected, err);
  }
}

/** Compact provider failure + one-click retry on a different mirror. */
function showResolverFailure(detail, selected, err) {
  const message = err.body?.error || err.message;
  const alternatives = (err.body?.alternatives || []).filter((a) => a.available);
  toast(message, 'err', 4200);

  const altRow = alternatives.length
    ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px' } },
      alternatives.map((alt) => h('button', {
        class: 'btn sm',
        onclick: () => { closeModal(); resolveAndPlay(detail, { ...selected, providerId: alt.id }); },
      }, `Retry on ${alt.name}`)))
    : h('div', { class: 'mono muted', style: { fontSize: '12px' } }, 'No alternate provider can serve this release right now.');

  modal({
    title: 'Resolver could not start playback',
    subtitle: detail.title,
    size: 'sm',
    body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      h('div', { class: 'code', style: { borderLeft: '3px solid var(--err)' } }, message),
      h('div', { class: 'mono muted', style: { fontSize: '11.5px' } },
        `Tried ${providerName(selected.providerId)} · requested ${selected.quality || 'Auto'}${selected.episode ? ` · S${String(selected.season).padStart(2, '0')}E${String(selected.episode).padStart(2, '0')}` : ''}`),
      alternatives.length ? h('div', { class: 'eyebrow' }, 'Fallback providers') : null,
      altRow),
    footer: [h('button', { class: 'btn sm ghost', onclick: () => closeModal() }, 'Dismiss')],
  });
}

function providerName(id) {
  return (store.get().meta?.providers || []).find((p) => p.id === id)?.name || id;
}

/** Quality + scope picker for queuing downloads. */
export async function downloadFlow(item, opts = {}) {
  const { profile, settings } = store.get();
  const detail = await api.title(item.id, profile);
  const enabled = (p) => settings?.providers?.[p.id] !== false;
  const providers = detail.providers.filter((p) => p.available && enabled(p));
  if (!providers.length) {
    toast('No provider can serve this title right now.', 'err');
    return;
  }
  let providerId = providers[0].id;
  let quality = '1080p';
  let season = opts.season || (detail.kind === 'm' ? 0 : 1);
  let wholeSeason = false;

  const providerRow = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px' } });
  const qualityRow = h('div', { style: 'display:flex;flex-wrap:wrap;gap:7px' });

  const rerender = () => {
    providerRow.replaceChildren(...providers.map((p) => h('button', {
      class: `chip${providerId === p.id ? ' active' : ''}`,
      onclick: () => { providerId = p.id; rerender(); },
    }, p.name, h('span', { class: 'mono', style: { fontSize: '10px', opacity: .7 } }, p.maxQuality))));
    const qualities = ['Auto', ...new Set(detail.releases.filter((r) => r.providerId === providerId).map((r) => r.quality))];
    qualityRow.replaceChildren(...qualities.map((q) => h('button', {
      class: `chip${quality === q ? ' active' : ''}`,
      onclick: () => { quality = q; rerender(); },
    }, q)));
  };
  rerender();

  const seasonSel = detail.kind === 'm' ? null : h('div', { class: 'field' },
    h('label', {}, 'Season'),
    h('select', { onchange: (e) => { season = Number(e.target.value); } },
      detail.seasonsDetail.map((b) => h('option', { value: b.season }, `Season ${b.season} · ${b.count} episodes`))));

  modal({
    title: `Download ${detail.title}`,
    subtitle: 'Multi-segment queue with pause, resume and retry',
    size: 'sm',
    body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Provider'), providerRow),
      h('div', {}, h('div', { class: 'eyebrow' }, 'Quality'), qualityRow),
      seasonSel,
      detail.kind === 'm' ? null : h('div', { class: 'toggle' },
        h('div', { class: 'body' }, h('b', {}, 'Whole season'), h('span', {}, 'Queue every episode, in order')),
        h('div', { class: 'switch', tabindex: '0', onclick: (e) => { wholeSeason = !wholeSeason; e.currentTarget.classList.toggle('on', wholeSeason); } }, h('i'))),
      h('div', { class: 'mono muted', style: { fontSize: '11px' } }, `Destination: ~/Movies/Moviejuke/${detail.kindLabel}/  ·  simulated transfer`)),
    footer: [
      h('button', { class: 'btn sm ghost', onclick: () => closeModal() }, 'Cancel'),
      h('button', {
        class: 'btn sm primary',
        onclick: async () => {
          closeModal();
          try {
            const res = await api.enqueue({ titleId: detail.id, provider: providerId, quality, season, episode: 1, allSeasons: wholeSeason });
            if (res.error) toast(res.error, 'err');
            else {
              toast(`Queued ${res.items.length} item${res.items.length > 1 ? 's' : ''} · ${detail.title}`, 'ok');
              location.hash = '#/downloads';
            }
          } catch (err) {
            toast(err.body?.error || err.message, 'err');
          }
        },
      }, svgIcon('download', 14), 'Queue download'),
    ],
  });
}

export async function toggleFavorite(item, onDone) {
  const { profile } = store.get();
  await api.libraryAction(profile, { action: 'favorite', titleId: item.id });
  toast('Library updated.', 'ok', 1800);
  onDone?.();
}

export function tuneSetting(patch) {
  updateSettings(patch).catch(() => toast('Could not save settings.', 'err'));
}
