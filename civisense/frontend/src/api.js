const BASE = import.meta.env.VITE_API_URL || '/api'

export function getImageUrl(path) {
  if (!path) return null;

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const backend = BASE.replace(/\/api\/?$/, '');
  return `${backend}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getToken() {
  try { return localStorage.getItem('cs_token') } catch { return null }
}
export function setToken(t) {
  try { t ? localStorage.setItem('cs_token', t) : localStorage.removeItem('cs_token') } catch { /* ignore */ }
}

async function request(path, { json, headers = {}, ...opts } = {}) {
  const h = { ...headers }
  const token = getToken()
  if (token) h.Authorization = `Bearer ${token}`
  if (json !== undefined) {
    h['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(json)
  }
  const res = await fetch(BASE + path, { ...opts, headers: h })
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    setToken(null) // expired or invalid token: drop it and let the UI show the logged-out state
    window.dispatchEvent(new Event('cs-auth-expired'))
  }
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch { /* keep statusText */ }
    throw new Error(msg || `Request failed (${res.status})`)
  }
  return res.json()
}

export const api = {
  meta: () => request('/meta'),
  health: () => request('/health'),
  login: (email, password) => request('/auth/login', { method: 'POST', json: { email, password } }),
  register: (name, email, password) => request('/auth/register', { method: 'POST', json: { name, email, password } }),
  me: () => request('/auth/me'),
  classify: (description, filename = '') => request('/classify', { method: 'POST', json: { description, filename } }),
  createReport: (formData) => request('/reports', { method: 'POST', body: formData }),
  reports: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    return request('/reports' + (qs ? `?${qs}` : ''))
  },
  report: (ref) => request(`/reports/${encodeURIComponent(ref)}`),
  support: (ref) => request(`/reports/${encodeURIComponent(ref)}/support`, { method: 'POST' }),
  updateStatus: (ref, payload) => request(`/reports/${encodeURIComponent(ref)}/status`, { method: 'PATCH', json: payload }),
  analytics: (includeSample = true) => request(`/analytics?include_sample=${includeSample}`),
  leaderboard: () => request('/leaderboard'),
  audit: () => request('/admin/audit?limit=100'),
  createStaff: (name, email, password, department) => request('/admin/authority-users', { method: 'POST', json: { name, email, password, department } }),
  staff: () => request('/admin/staff'),
  setDepartment: (id, department) => request(`/admin/staff/${id}`, { method: 'PATCH', json: { department } }),
  forward: (ref, payload) => request(`/reports/${encodeURIComponent(ref)}/forward`, { method: 'POST', json: payload }),
  review: (ref, payload) => request(`/reports/${encodeURIComponent(ref)}/review`, { method: 'POST', json: payload }),
  assign: (ref, message) => request(`/reports/${encodeURIComponent(ref)}/assign`, { method: 'POST', json: { message } }),
}

export const STATUS_LABEL = {
  submitted: 'Submitted', under_review: 'Under review', assigned: 'Assigned',
  in_progress: 'In progress', resolved: 'Resolved', rejected: 'Rejected',
  forwarded: 'With department', approved: 'Approved, ready to assign',
}
export const RISK_LABEL = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' }
export const RISK_COLOR = { high: '#B3362B', medium: '#B45F06', low: '#1F7A5C' }
export const publicStatus = (s) => (s === 'forwarded' || s === 'approved' ? 'under_review' : s)
export const STATUS_COLOR = {
  submitted: '#5B6B66', under_review: '#B45F06', assigned: '#1D64B8',
  in_progress: '#6D44C2', resolved: '#1F7A5C', rejected: '#B3362B',
  forwarded: '#0F766E', approved: '#3F6212',
}
export const TIER_COLOR = { critical: '#B3362B', high: '#C25E00', moderate: '#8A6B00', low: '#1F7A5C' }
export const fmtDate = (iso) => new Date(iso).toLocaleString()
