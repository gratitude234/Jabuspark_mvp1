import { storage } from './storage'

/**
 * API base (Vite env first, then window override, then default production domain)
 * In production you said: https://jabumarket.com.ng/api
 */
export const API_BASE =
  (import.meta?.env?.VITE_API_BASE || '') ||
  (typeof window !== 'undefined' && window.__JABUSPARK_API_BASE__) ||
  'https://jabumarket.com.ng/api'

function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '')
  const p = String(path || '').replace(/^\/+/, '')
  return `${b}/${p}`
}

async function readJsonSafe(res) {
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/**
 * apiFetch('/health') -> GET https://.../health
 * apiFetch('/auth/login', { method:'POST', body:{...} })
 */
export async function apiFetch(path, { method = 'GET', body = null, headers = {}, raw = false } = {}) {
  const token = storage.get('token', null)

  const h = new Headers(headers)
  h.set('Accept', 'application/json')

  let payload = body
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData

  if (token) h.set('Authorization', `Bearer ${token}`)

  if (body && !isForm && typeof body === 'object' && !(body instanceof Blob)) {
    h.set('Content-Type', 'application/json')
    payload = JSON.stringify(body)
  }

  const url = joinUrl(API_BASE, path)

  let res
  try {
    res = await fetch(url, { method, headers: h, body: method === 'GET' ? undefined : payload })
  } catch (e) {
    throw new ApiError('Network error. Check your internet or API base URL.', { status: 0 })
  }

  if (raw) return res

  const data = await readJsonSafe(res)

  if (res.status === 401) {
    // session expired or invalid token -> clear local auth
    storage.remove('token')
    storage.remove('user')
    // let the app react (router guard will send them to login)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`
    throw new ApiError(msg, { status: res.status, data })
  }

  return data
}
