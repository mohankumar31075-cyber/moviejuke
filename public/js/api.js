/**
 * API client.
 *
 * Two transports are available and share one interface:
 *   - HTTP   : the Node server in this repository (default)
 *   - static : prerendered JSON produced by `scripts/build-static.js`, used for
 *              hosting on a plain static host such as GitHub Pages
 *
 * The static transport is selected by setting `window.__MJ_STATIC__ = true`
 * before this module loads (the build injects that flag into index.html).
 */

import { store, toast, applySettings, updateSettings, setSettingsSaver } from './state.js';

export { store, toast, applySettings, updateSettings };

const json = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
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

function clean(params = {}) {
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out;
}

export const httpApi = {
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

setSettingsSaver(async (patch) => {
  const res = await httpApi.settings(patch);
  return res.settings;
});

const isStatic = typeof window !== 'undefined' && window.__MJ_STATIC__ === true;
const local = isStatic ? await import('./api-local.js') : null;

/** Active transport. Views only ever talk to this object. */
export const api = local ? local.staticApi : httpApi;
