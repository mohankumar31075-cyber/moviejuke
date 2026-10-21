const TOKEN_KEY = 'kb_token';
const PROFILE_KEY = 'kb_profile';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));
export const getProfileId = () => localStorage.getItem(PROFILE_KEY);
export const setProfileId = (id) => (id ? localStorage.setItem(PROFILE_KEY, id) : localStorage.removeItem(PROFILE_KEY));

async function request(path, { method = 'GET', body, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const pid = getProfileId();
  if (pid) headers['X-Profile-Id'] = pid;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (raw) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: body || {} }),
  put: (p, body) => request(p, { method: 'PUT', body: body || {} }),
  raw: (p) => request(p, { raw: true }),
};

export async function downloadFile(path, filename) {
  const res = await api.raw(path);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
