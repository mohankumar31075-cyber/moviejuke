/** Thin API client + app-wide store for Moviejuke. */

const json = async (res) => {
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return body;
};

async function req(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const body = await json(res);
  if (!res.ok) {
    const err = new Error(body?.error || body?.detail || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  meta: () => req('/api/meta'),
  home: (profile) => req(`/api/home?profile=${profile}`),
  browse: (params) => req(`/api/browse?${new URLSearchParams(clean(params))}`),
  title: (id, profile) => req(`/api/title/${encodeURIComponent(id)}?profile=${profile}`),
  stream: (params) => req(`/api/stream?${new URLSearchParams(clean(params))}`),
  live: () => req('/api/live'),
  speedTest: () => req('/api/speedtest'),
  downloads: () => req('/api/downloads'),
  enqueue: (body) => req('/api/downloads', { method: 'POST', body }),
  downloadAction: (body) => req('/api/downloads', { method: 'PATCH', body }),
  removeDownload: (id) => req('/api/downloads', { method: 'DELETE', body: { id } }),
  library: (profile) => req(`/api/library?profile=${profile}`),
  libraryAction: (profile, body) => req(`/api/library?profile=${profile}`, { method: 'POST', body }),
  settings: (body) => req('/api/settings', body ? { method: 'POST', body } : {}),
  stats: () => req('/api/stats'),
  launch: () => req('/api/stats', { method: 'POST', body: { action: 'launch' } }),
};

function clean(params = {}) {
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out;
}

/* ------------------------------------------------------------------- store */

const listeners = new Set();

export const store = {
  state: {
    meta: null,
    settings: null,
    profiles: [],
    profile: null,
    stats: null,
    toasts: [],
  },
  get() {
    return this.state;
  },
  set(patch) {
    this.state = { ...this.state, ...patch };
    listeners.forEach((fn) => fn(this.state));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function toast(message, kind = 'info', ms = 3600) {
  const id = Math.random().toString(36).slice(2);
  store.set({ toasts: [...store.get().toasts, { id, message, kind }] });
  setTimeout(() => {
    store.set({ toasts: store.get().toasts.filter((t) => t.id !== id) });
  }, ms);
}

/** Apply server settings to the document (theme, accent, density, motion). */
export function applySettings(settings) {
  if (!settings) return;
  const root = document.documentElement;
  root.dataset.theme = settings.theme || 'Moviejuke';
  if (settings.accent) root.style.setProperty('--accent', settings.accent);
  root.style.setProperty('--density', settings.density === 'compact' ? '0.92' : settings.density === 'spacious' ? '1.08' : '1');
  root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full';
}

export async function updateSettings(patch) {
  const res = await api.settings(patch);
  store.set({ settings: res.settings });
  applySettings(res.settings);
  return res.settings;
}
