import { api, toast } from '../api.js';
import { h, panel, stat, svgIcon, fmt, sectionHead } from '../components.js';

let poll = null;

export async function render(ctx) {
  const root = h('div', {});
  const queueHost = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
  const historyHost = h('div', {});
  const statHost = h('div', { class: 'stat-strip', style: { marginBottom: '16px' } });
  let data = { active: [], history: [], totalBytes: 0 };

  function draw() {
    const active = data.active || [];
    const running = active.filter((d) => d.state === 'downloading');
    const totalSpeed = running.reduce((s, d) => s + (d.speedMbps || 0), 0);
    const remaining = active.reduce((s, d) => s + Math.max(0, d.sizeGb - d.downloadedGb), 0);

    statHost.replaceChildren(
      stat(String(running.length), 'active transfers'),
      stat(`${totalSpeed.toFixed(1)} Mb/s`, 'aggregate speed'),
      stat(fmt.gb(remaining), 'remaining'),
      stat(fmt.gb(data.totalBytes || 0), 'pulled lifetime'),
      stat(String((data.history || []).length), 'completed'));

    queueHost.replaceChildren(...(active.length
      ? active.map(downloadCard)
      : [h('div', { class: 'empty' },
        h('div', { class: 'big' }, '⇣'),
        h('div', {}, 'Queue is empty.'),
        h('div', { class: 'mono muted', style: { fontSize: '12px', marginTop: '6px' } }, 'Queue something from a title page, or hit Download on any card.'))]));

    const history = (data.history || []).slice(0, 20);
    historyHost.replaceChildren(history.length
      ? h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Title'), h('th', {}, 'Release'), h('th', {}, 'Size'), h('th', {}, 'Provider'), h('th', {}, 'Finished'), h('th', {}, ''))),
        h('tbody', {}, history.map((d) => h('tr', {},
          h('td', {}, h('b', {}, d.title), h('div', { class: 'mono muted', style: { fontSize: '10.5px' } }, d.label)),
          h('td', { class: 'mono', style: { fontSize: '11px' } }, d.quality),
          h('td', { class: 'num' }, fmt.gb(d.sizeGb)),
          h('td', {}, h('span', { class: 'tag' }, d.provider)),
          h('td', { class: 'mono muted', style: { fontSize: '11px' } }, d.completedAt ? new Date(d.completedAt).toLocaleTimeString() : '—'),
          h('td', {}, h('button', { class: 'btn xs ghost', onclick: () => toast(`Re-queued ${d.title} ${d.label}`, 'ok', 2000) }, svgIcon('refresh', 12)))))))
      : h('div', { class: 'muted mono', style: { padding: '14px' } }, 'No completed transfers yet.'));
  }

  function downloadCard(d) {
    const pct = d.sizeGb ? Math.min(100, (d.downloadedGb / d.sizeGb) * 100) : 0;
    const stateTag = { downloading: 'info', paused: 'warn', completed: 'ok', failed: 'err', queued: '' }[d.state] || '';
    const segments = Array.from({ length: d.segments || 1 }, (_, i) => {
      const share = Math.min(1, Math.max(0, pct / 100 * (d.segments || 1) - i));
      return h('i', {}, h('b', { style: { width: `${share * 100}%` } }));
    });
    return h('article', { class: 'dl-item' },
      h('div', {},
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' } },
          h('b', { style: { fontSize: '14px' } }, d.title),
          h('span', { class: 'tag accent' }, d.label),
          h('span', { class: 'tag' }, d.quality),
          h('span', { class: `tag ${stateTag}` }, d.state)),
        h('div', { class: 'bar', style: { marginTop: '9px' } }, h('i', { style: { width: `${pct}%` } })),
        h('div', { class: 'dl-meta' },
          h('span', {}, `${fmt.gb(d.downloadedGb)} / ${fmt.gb(d.sizeGb)}`),
          h('span', {}, `${pct.toFixed(1)}%`),
          h('span', {}, d.state === 'downloading' ? `${d.speedMbps} Mb/s` : d.state === 'paused' ? 'paused' : d.state === 'failed' ? 'failed' : 'complete'),
          h('span', {}, `eta ${fmt.eta(d.etaSec)}`),
          h('span', {}, `${d.segments}× segment${d.segments > 1 ? 's' : ''}`),
          h('span', {}, d.provider)),
        h('div', { class: 'seg-strip' }, segments),
        d.error ? h('div', { class: 'mono', style: { color: 'var(--err)', fontSize: '11px', marginTop: '7px' } }, d.error) : null),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' } },
        d.state === 'downloading' ? h('button', { class: 'btn xs', onclick: () => act({ action: 'pause', id: d.id }) }, svgIcon('pause', 12), 'Pause') : null,
        d.state === 'paused' ? h('button', { class: 'btn xs primary', onclick: () => act({ action: 'resume', id: d.id }) }, svgIcon('play', 12), 'Resume') : null,
        d.state === 'failed' ? h('button', { class: 'btn xs', onclick: () => act({ action: 'retry', id: d.id }) }, svgIcon('refresh', 12), 'Retry') : null,
        d.state !== 'completed' ? h('button', { class: 'btn xs ghost', title: 'Double the connection pool', onclick: () => act({ action: 'boost', id: d.id }) }, svgIcon('bolt', 12), 'Boost') : null,
        h('button', { class: 'btn xs ghost', title: 'Remove', onclick: async () => { await api.removeDownload(d.id); toast('Removed from queue.', 'ok', 1600); refresh(); } }, svgIcon('trash', 12))));
  }

  async function act(body) {
    await api.downloadAction(body);
    refresh();
  }

  async function refresh() {
    try {
      data = await api.downloads();
      draw();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  root.append(sectionHead('Downloads', 'Multi-segment queue · HTTP range pause & resume'),
    h('div', { style: { display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' } },
      h('button', { class: 'btn sm', onclick: () => toast('Queue flushed to disk (simulated).', 'ok', 1800) }, svgIcon('check', 14), 'Flush to disk'),
      h('button', { class: 'btn sm ghost', onclick: async () => {
        const ids = (data.active || []).map((d) => d.id);
        await Promise.all(ids.map((id) => api.removeDownload(id)));
        toast(`Cleared ${ids.length} transfer${ids.length === 1 ? '' : 's'}.`, 'ok');
        refresh();
      } }, svgIcon('trash', 14), 'Clear queue'),
      h('button', { class: 'btn sm ghost', onclick: () => { location.hash = '#/browse'; } }, svgIcon('grid', 14), 'Find something')),
    statHost,
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      panel('Active queue', queueHost),
      panel('Completed', historyHost)));

  await refresh();
  clearInterval(poll);
  poll = setInterval(refresh, 1400);
  return root;
}

export function teardown() {
  clearInterval(poll);
}
