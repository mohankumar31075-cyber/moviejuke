import { api, store, toast } from '../api.js';
import { h, posterCard, rowCard, stat, panel, sectionHead, svgIcon, fmt } from '../components.js';

export async function render(ctx) {
  const { profile } = store.get();
  const root = h('div', {});
  const host = h('div', {});
  let lib = await api.library(profile);
  let stats = await api.stats().catch(() => ({}));
  let tab = ctx.query.get('tab') || 'resume';

  const tabsEl = h('div', { class: 'tabs' });
  const statHost = h('div', { class: 'stat-strip', style: { marginBottom: '16px' } });

  function drawStats() {
    statHost.replaceChildren(
      stat(String((lib.resume || []).length), 'in progress'),
      stat(String((lib.favorites || []).length), 'favorites'),
      stat(String((lib.history || []).length), 'history entries'),
      stat(String(stats.downloadsToday || 0), 'downloads today'),
      stat(fmt.gb(stats.bytesPulled || 0), 'pulled lifetime'));
  }

  function drawTabs() {
    const defs = [
      { id: 'resume', label: `Continue watching (${(lib.resume || []).length})` },
      { id: 'favorites', label: `Favorites (${(lib.favorites || []).length})` },
      { id: 'history', label: `History (${(lib.history || []).length})` },
    ];
    tabsEl.replaceChildren(...defs.map((d) => h('button', {
      class: d.id === tab ? 'on' : '',
      onclick: () => { tab = d.id; drawTabs(); drawBody(); },
    }, d.label)));
  }

  function drawBody() {
    if (tab === 'resume') {
      host.replaceChildren((lib.resume || []).length
        ? h('div', { class: 'grid-cards' }, lib.resume.map((r) => posterCard(r.item, {
          progress: r.duration ? (r.position / r.duration) * 100 : 0,
        })))
        : emptyState('Nothing in progress', 'Start playback and the resume deck tracks your position locally.'));
      return;
    }
    if (tab === 'favorites') {
      host.replaceChildren((lib.favorites || []).length
        ? h('div', { class: 'grid-cards' }, lib.favorites.map((item) => posterCard(item)))
        : emptyState('No favorites yet', 'Tap Favorite on any title to pin it here.'));
      return;
    }
    host.replaceChildren((lib.history || []).length
      ? h('div', { class: 'panel' }, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        lib.history.map((entry) => rowCard({ ...entry.item, year: entry.item.year }, {
          meta: `${new Date(entry.at).toLocaleString()}${entry.season ? ` · S${String(entry.season).padStart(2, '0')}E${String(entry.episode).padStart(2, '0')}` : ''}`,
        }))))
      : emptyState('History is empty', 'Playback events are stored on this server, never shared.'));
  }

  function emptyState(title, note) {
    return h('div', { class: 'empty' }, h('div', { class: 'big' }, '∅'), h('div', {}, title), h('div', { class: 'mono muted', style: { fontSize: '12px', marginTop: '6px' } }, note));
  }

  async function action(body, message) {
    await api.libraryAction(profile, body);
    toast(message, 'ok', 2000);
    lib = await api.library(profile);
    stats = await api.stats().catch(() => stats);
    drawStats();
    drawTabs();
    drawBody();
  }

  root.append(sectionHead('Your library', `Profile: ${lib.profile} · stored at data/state.json · zero telemetry`),
    h('div', { style: { display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' } },
      h('button', { class: 'btn sm ghost', onclick: () => action({ action: 'clear-history' }, 'History cleared.') }, svgIcon('trash', 14), 'Clear history'),
      h('button', { class: 'btn sm ghost', onclick: () => action({ action: 'clear-favorites' }, 'Favorites cleared.') }, svgIcon('trash', 14), 'Clear favorites'),
      h('button', { class: 'btn sm ghost', onclick: async () => {
        const res = await api.speedTest();
        toast(`Probe: ${res.results.map((r) => `${r.provider} ${r.verdict}`).join(' · ')}`, 'info', 4200);
      } }, svgIcon('signal', 14), 'Probe mirrors')),
    statHost, tabsEl, host);

  drawStats();
  drawTabs();
  drawBody();
  return root;
}
