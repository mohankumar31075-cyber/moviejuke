/**
 * Shared client state: store, toasts, theme application and settings
 * persistence. Kept separate from `api.js` so the HTTP client and the static
 * (prerendered) client can both drive the same UI without circular imports.
 */

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

/** Apply settings to the document (theme, accent, density, motion). */
export function applySettings(settings) {
  if (!settings) return;
  const root = document.documentElement;
  root.dataset.theme = settings.theme || 'Moviejuke';
  if (settings.accent) root.style.setProperty('--accent', settings.accent);
  root.style.setProperty('--density', settings.density === 'compact' ? '0.92' : settings.density === 'spacious' ? '1.08' : '1');
  root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full';
}

/**
 * Settings are persisted by whichever transport is active: the API client
 * POSTs to /api/settings, the static client writes to localStorage.
 */
let settingsSaver = async (patch) => patch;

export function setSettingsSaver(fn) {
  settingsSaver = fn;
}

export async function updateSettings(patch) {
  const saved = await settingsSaver(patch);
  store.set({ settings: saved });
  applySettings(saved);
  return saved;
}

/** Tiny seeded PRNG shared by the static client's generated payloads. */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
