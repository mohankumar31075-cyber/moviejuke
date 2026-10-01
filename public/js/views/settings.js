import { api, store, toast, updateSettings } from '../api.js';
import { h, panel, toggleRow, svgIcon, fmt, sectionHead, stat, codeBlock } from '../components.js';

const ACCENTS = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#6366f1', '#a855f7', '#f472b6', '#94a3b8'];

export async function render(ctx) {
  const state = store.get();
  const settings = state.settings;
  const meta = state.meta;
  const root = h('div', {});

  const save = async (patch, note) => {
    try {
      await updateSettings(patch);
      if (note) toast(note, 'ok', 1800);
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  // --------------------------------------------------------------- themes
  const themeSwatches = h('div', { class: 'swatches' }, meta.themes.map((name) => {
    const preview = themePreview(name);
    const on = settings.theme === name;
    return h('button', { class: `swatch${on ? ' on' : ''}`, title: name, onclick: async (e) => {
      await save({ theme: name }, `Theme: ${name}`);
      root.querySelectorAll('.swatch').forEach((el) => el.classList.remove('on'));
      e.currentTarget.classList.add('on');
    } },
    h('div', { class: 'chips' }, preview.map((c) => h('i', { style: { background: c } }))),
    h('div', { class: 'nm' }, name));
  }));

  const accentRow = h('div', { class: 'swatches' }, ACCENTS.map((c) => h('button', {
    class: 'swatch',
    style: { width: '44px', padding: '5px', background: settings.accent === c ? 'var(--elev)' : 'var(--panel)' },
    title: c,
    onclick: () => save({ accent: c }, `Accent ${c}`),
  }, h('i', { style: { display: 'block', width: '100%', height: '22px', borderRadius: '6px', background: c } }))));

  // ------------------------------------------------------------ providers
  const providerToggles = h('div', {}, meta.providers.map((p) => toggleRow(
    p.name,
    `${p.transport} · ${p.note}`,
    settings.providers?.[p.id] !== false,
    (on) => save({ providers: { [p.id]: on } }, `${p.name} ${on ? 'enabled' : 'disabled'}`),
  )));

  const speedHost = h('div', { class: 'mono muted', style: { fontSize: '12px' } }, 'No probe yet this session.');

  root.append(sectionHead('Settings', 'Everything is stored server-side in data/state.json'));

  root.append(h('div', { class: 'grid cols-2' },
    panel('Appearance',
      h('div', { class: 'eyebrow' }, 'Theme'),
      themeSwatches,
      h('div', { class: 'eyebrow', style: { marginTop: '16px' } }, 'Accent'),
      accentRow,
      h('div', { style: { marginTop: '16px' } },
        h('div', { class: 'field' },
          h('label', {}, 'Density'),
          h('select', { onchange: (e) => save({ density: e.target.value }) },
            ['compact', 'comfortable', 'spacious'].map((d) => h('option', { value: d, selected: settings.density === d ? '' : null }, d)))),
        toggleRow('Reduce motion', 'Disables transitions, carousel rotation and visualiser animation', settings.reduceMotion, (on) => save({ reduceMotion: on })))),
    panel('Playback',
      h('div', { class: 'field' },
        h('label', {}, 'Default quality'),
        h('select', { onchange: (e) => save({ defaultQuality: e.target.value }, `Quality: ${e.target.value}`) },
          ['Auto', '4K', '1440p', '1080p', '720p', '480p'].map((q) => h('option', { value: q, selected: settings.defaultQuality === q ? '' : null }, q)))),
      h('div', { class: 'field' },
        h('label', {}, 'Preferred player'),
        h('select', { onchange: (e) => save({ player: e.target.value }, `Player: ${e.target.value}`) },
          (meta.players || []).map((p) => h('option', { value: p.id, selected: settings.player === p.id ? '' : null }, `${p.label} — ${p.note}`)))),
      h('div', { class: 'field' },
        h('label', {}, 'Default subtitle language'),
        h('select', { onchange: (e) => save({ subtitlesDefault: e.target.value }) },
          meta.subtitles.map((s) => h('option', { value: s, selected: settings.subtitlesDefault === s ? '' : null }, s)))),
      toggleRow('Autoplay next episode', 'Rolls into the next episode when a stream ends', settings.autoplayNext, (on) => save({ autoplayNext: on })),
      toggleRow('Hardware decode hints', 'Sends hardware-decode flags to the selected player', settings.hardwareDecode, (on) => save({ hardwareDecode: on }))),
    panel('Providers',
      providerToggles,
      toggleRow('BDIX network available', 'CircleFTP only resolves from BDIX-capable networks', settings.bdix, (on) => save({ bdix: on }, `BDIX ${on ? 'reachable' : 'blocked'}`)),
      h('div', { class: 'mono muted', style: { fontSize: '11px', marginTop: '10px' } },
        'Disabling a provider removes it from the resolver, exactly like the TUI provider stack.')),
    panel('Profiles',
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        state.profiles.map((p) => h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          h('div', { class: 'avatar', style: { background: p.accent, color: '#0b0b0e' } }, p.name.split(' ').map((w) => w[0]).join('').slice(0, 2)),
          h('div', { style: { flex: '1' } }, h('b', {}, p.name), h('div', { class: 'mono muted', style: { fontSize: '10.5px' } }, p.pin ? 'PIN protected · kids' : 'standard profile')),
          p.id === state.profile
            ? h('span', { class: 'tag ok' }, 'active')
            : h('button', { class: 'btn xs', onclick: async () => { await save({ currentProfile: p.id }, `Switched to ${p.name}`); location.reload(); } }, 'Switch')))),
      h('div', { class: 'mono muted', style: { fontSize: '11px', marginTop: '12px' } }, 'Favorites, progress and history are keyed per profile.')),
  ));

  // ----------------------------------------------------------- probe + data
  root.append(h('div', { class: 'grid cols-2', style: { marginTop: '16px' } },
    panel('Mirror probe',
      h('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' } },
        h('button', { class: 'btn sm', onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try {
            const res = await api.speedTest();
            speedHost.replaceChildren(h('table', { class: 'table' },
              h('thead', {}, h('tr', {}, h('th', {}, 'Mirror'), h('th', {}, 'RTT'), h('th', {}, 'Throughput'), h('th', {}, 'Loss'), h('th', {}, 'Verdict'))),
              h('tbody', {}, res.results.map((r) => h('tr', {},
                h('td', {}, r.provider, h('div', { class: 'mono muted', style: { fontSize: '10px' } }, r.mirror)),
                h('td', { class: 'num' }, `${r.latencyMs} ms`),
                h('td', { class: 'num' }, r.throughput),
                h('td', { class: 'num' }, r.packetLoss),
                h('td', {}, h('span', { class: `tag ${r.verdict === 'Ready' ? 'ok' : 'warn'}` }, r.verdict)))))));
          } catch (err) {
            toast(err.message, 'err');
          } finally {
            btn.disabled = false;
          }
        } }, svgIcon('signal', 14), 'Run probe')),
      speedHost),
    panel('Shortcuts & data',
      h('table', { class: 'table' },
        h('tbody', {},
          ...[['/', 'Focus search'], ['⌘/Ctrl + K', 'Command palette'], ['g h', 'Home'], ['g b', 'Browse'], ['g l', 'Live TV'], ['g d', 'Downloads'], ['g y', 'Library'], ['?', 'Shortcut sheet'], ['Esc', 'Close overlay']]
            .map(([k, v]) => h('tr', {}, h('td', { class: 'mono', style: { width: '120px' } }, k), h('td', {}, v))))),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' } },
        h('button', { class: 'btn sm ghost', onclick: async () => {
          await api.settings({ theme: 'Moviejuke', accent: '#e11d48', providers: { moviebox: true, fourkhdhub: true, circleftp: true, addons: false }, bdix: true, defaultQuality: 'Auto', density: 'comfortable', reduceMotion: false });
          toast('Settings restored to defaults.', 'ok');
          location.reload();
        } }, svgIcon('refresh', 14), 'Reset settings'),
        h('button', { class: 'btn sm ghost', onclick: async () => {
          const s = await api.stats();
          toast(`${s.titles} titles · ${s.launches} launches · ${s.resolutions} resolutions`, 'info', 3600);
        } }, svgIcon('layers', 14), 'Session stats')),
      h('div', { style: { marginTop: '12px' } },
        codeBlock(`moviejuke/
├── server.js          # zero-dependency HTTP + JSON API
├── data/catalog.js    # ${meta.facets.genres.length} genres · hand-written titles
├── data/engine.js     # deterministic resolver
└── public/            # client (this UI)`))),
  ));

  root.append(h('div', { class: 'stat-strip', style: { marginTop: '16px' } },
    stat(`v${meta.version}`, 'client build'),
    stat(String(meta.providers.length), 'providers'),
    stat(String(meta.facets.genres.length), 'genres'),
    stat(String(meta.subtitles.length), 'subtitle langs'),
    stat(settings.bdix ? 'BDIX' : 'no BDIX', 'network mode')));

  const state2 = store.get();
  root.append(h('div', { class: 'mono muted', style: { fontSize: '11px', marginTop: '14px' } },
    `profile ${state2.profile} · theme ${settings.theme} · density ${settings.density}`));

  return root;
}

function themePreview(name) {
  const map = {
    'Moviejuke': ['#e11d48', '#0b0e15', '#e8ecf4'],
    'Catppuccin Mocha': ['#cba6f7', '#1e1e2e', '#cdd6f4'],
    'Tokyo Night': ['#7aa2f7', '#1a1b26', '#c0caf5'],
    'Dracula': ['#bd93f9', '#282a36', '#f8f8f2'],
    'Nord': ['#88c0d0', '#2e3440', '#eceff4'],
    'Gruvbox Dark': ['#fabd2f', '#282828', '#ebdbb2'],
    'One Dark': ['#61afef', '#282c34', '#abb2bf'],
    'Solarized Light': ['#b58900', '#fbf7ee', '#073642'],
    'Monochrome': ['#f2f2f2', '#101010', '#bdbdbd'],
  };
  return map[name] || ['#888', '#222', '#eee'];
}
