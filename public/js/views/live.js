import { api, toast } from '../api.js';
import { h, panel, stat, svgIcon, codeBlock, fmt, sectionHead } from '../components.js';

export async function render(ctx) {
  const data = await api.live();
  const root = h('div', {});
  let category = 'All';
  let region = 'All';
  let query = '';
  let selected = ctx.query.get('channel') || data.channels[0].id;

  const listHost = h('div', { class: 'channel-list' });
  const detailHost = h('div', {});
  const filterRow = h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '12px' } });
  const search = h('input', {
    type: 'text', placeholder: 'Filter channels…', value: '',
    style: { width: '100%', height: '34px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '9px', padding: '0 10px', outline: 'none' },
    oninput: (e) => { query = e.target.value.toLowerCase(); drawList(); },
  });

  function visible() {
    return data.channels
      .filter((c) => category === 'All' || c.category === category)
      .filter((c) => region === 'All' || c.region === region)
      .filter((c) => !query || c.name.toLowerCase().includes(query) || c.now.title.toLowerCase().includes(query));
  }

  function drawFilters() {
    filterRow.replaceChildren(
      ...data.categories.map((c) => h('button', { class: `chip${category === c ? ' active' : ''}`, onclick: () => { category = c; redraw(); } }, c)),
      h('span', { style: { width: '1px', background: 'var(--line)', margin: '0 4px' } }),
      ...data.regions.map((r) => h('button', { class: `chip${region === r ? ' active' : ''}`, onclick: () => { region = r; redraw(); } }, r === 'All' ? 'All regions' : r)));
  }

  function channelNode(c) {
    return h('div', {
      class: `channel${c.id === selected ? ' on' : ''}`,
      onclick: () => { selected = c.id; drawList(); drawDetail(); },
    },
    h('span', { class: 'num' }, String(c.number)),
    h('span', { class: 'dot-live' }),
    h('div', { class: 'nm' },
      h('b', { class: 'truncate' }, c.name),
      h('span', {}, `${c.now.startLabel} ${c.now.title}`)),
    h('span', { class: 'tag' }, c.quality));
  }

  function drawList() {
    const items = visible();
    listHost.replaceChildren(...(items.length
      ? items.map(channelNode)
      : [h('div', { class: 'muted mono', style: { padding: '20px' } }, 'no channels match')]));
  }

  function drawDetail() {
    const ch = data.channels.find((c) => c.id === selected) || data.channels[0];
    detailHost.replaceChildren(
      h('div', { class: 'panel', style: { marginBottom: '16px' } },
        h('div', { style: { display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' } },
          h('div', { class: 'avatar', style: { width: '44px', height: '44px', borderRadius: '12px', background: ch.accent, color: '#0b0b0e', fontSize: '13px' } }, String(ch.number)),
          h('div', { style: { flex: '1', minWidth: '220px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' } },
              h('h1', { style: { fontSize: '22px' } }, ch.name),
              h('span', { class: 'dot-live' }),
              h('span', { class: 'tag accent' }, `${ch.category} · ${ch.region}`),
              h('span', { class: 'tag' }, ch.quality),
              h('span', { class: 'tag' }, ch.language),
              h('span', { class: 'tag' }, ch.bitrate)),
            h('div', { class: 'mono muted', style: { fontSize: '11.5px', marginTop: '4px' } },
              `${fmt.num(ch.viewers)} viewers · stream uptime ${ch.uptime} · ${ch.stream.format}`)),
          h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', { class: 'btn sm primary', onclick: () => toast(`Opening ${ch.name} in player… (simulated live transport)`, 'info') }, svgIcon('play', 14), 'Watch live'),
            h('button', { class: 'btn sm', onclick: () => toast(`Recording ${ch.name} for 30 min → ~/Recordings/Moviejuke`, 'ok', 2600) }, svgIcon('clock', 14), 'Record 30m'),
            h('button', { class: 'btn sm ghost', onclick: () => { navigator.clipboard?.writeText(ch.stream.url); toast('Stream URL copied.', 'ok', 1600); } }, svgIcon('copy', 14), 'Stream URL'))),
        h('div', { class: 'bar', style: { margin: '16px 0 10px' } }, h('i', { style: { width: `${ch.progress}%` } })),
        h('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
          h('div', { class: 'mono', style: { fontSize: '11.5px' } },
            h('div', { class: 'muted' }, `NOW · ${ch.now.startLabel}–${ch.now.endLabel}`),
            h('div', { style: { fontWeight: '600' } }, ch.now.title),
            h('div', { class: 'muted' }, `★ ${ch.now.rating} · ${Math.round(ch.progress)}% elapsed`)),
          h('div', { class: 'mono', style: { fontSize: '11.5px' } },
            h('div', { class: 'muted' }, `NEXT · ${ch.next.startLabel}–${ch.next.endLabel}`),
            h('div', { style: { fontWeight: '600' } }, ch.next.title),
            h('div', { class: 'muted' }, `★ ${ch.next.rating} · ${ch.next.length} min`)))),
      panel(`24h EPG · ${ch.name}`, epgTrack(ch)),
      h('div', { class: 'grid cols-2' },
        panel('Playlist import',
          codeBlock(data.playlist),
          h('div', { class: 'mono muted', style: { fontSize: '11px', marginTop: '10px' } }, data.epgWindow)),
        panel('Stream contract',
          h('table', { class: 'table' },
            h('tbody', {},
              row('Endpoint', ch.stream.url),
              row('Container', ch.stream.format),
              row('User agent', ch.stream.userAgent),
              row('Category', ch.category),
              row('Bitrate', ch.bitrate),
              row('Uptime', ch.uptime))),
          h('div', { class: 'mono muted', style: { fontSize: '11px', marginTop: '8px' } },
            'Live traffic is simulated: no upstream M3U source is contacted from a sandbox.'))));
  }

  function row(k, v) {
    return h('tr', {}, h('td', { class: 'mono muted', style: { width: '110px' } }, k), h('td', { class: 'mono', style: { fontSize: '11.5px', wordBreak: 'break-all' } }, v));
  }

  function redraw() {
    drawFilters();
    drawList();
  }

  root.append(sectionHead('Live TV', `${data.channels.length} channels · M3U import · EPG scheduling`));
  root.append(h('div', { class: 'stat-strip', style: { marginBottom: '16px' } },
    stat(String(data.channels.length), 'channels'),
    stat(String(data.categories.length - 1), 'categories'),
    stat(String(data.regions.length - 1), 'regions'),
    stat('24h', 'EPG depth'),
    stat('HLS', 'delivery')));
  root.append(h('div', { class: 'live-grid' },
    h('div', {},
      h('div', { class: 'panel', style: { marginBottom: '12px' } }, search),
      filterRow,
      listHost),
    detailHost));

  redraw();
  drawDetail();
  return root;
}

function epgTrack(ch) {
  return h('div', { class: 'epg-track' }, ch.epg.slice(0, 16).map((slot) => h('div', {
    class: `epg-cell${slot.startLabel === ch.now.startLabel ? ' now' : ''}`,
  },
  h('div', { class: 'tm' }, `${slot.startLabel}–${slot.endLabel}`),
  h('div', { class: 'tt' }, slot.title),
  h('div', { class: 'tm' }, `${slot.length} min · ★ ${slot.rating}`),
  slot.startLabel === ch.now.startLabel ? h('div', { class: 'bar' }, h('i', { style: { width: `${ch.progress}%` } })) : null)));
}
