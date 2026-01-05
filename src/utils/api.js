import { storage } from './storage'

/**
 * API base (Vite env first, then window override, then default production domain)
 * In production you said: https://jabumarket.com.ng/api
 */
export const API_BASE =
  (import.meta?.env?.VITE_API_BASE || '') ||
  (typeof window !== 'undefined' && window.__JABUSPARK_API_BASE__) ||
  'https://jabumarket.com.ng/api'

/**
 * Files base (where uploaded PDFs/images live).
 *
 * Why this exists:
 * If your backend returns a relative path like "/uploads/materials/abc.pdf",
 * and your frontend is hosted on Vercel, then opening that path will hit Vercel
 * (which will often serve your SPA index.html) instead of the real PDF.
 */
export const FILES_BASE =
  (import.meta?.env?.VITE_FILES_BASE || '') ||
  (typeof window !== 'undefined' && window.__JABUSPARK_FILES_BASE__) ||
  String(API_BASE).replace(/\/?api\/?$/i, '')

export function resolveFileUrl(input) {
  const v = String(input || '').trim()
  if (!v) return ''

  // Already absolute or special URL
  if (/^(https?:)?\/\//i.test(v) || /^data:|^blob:/i.test(v)) return v

  // Keep local demo assets working (served by the frontend)
  if (v.startsWith('/sample/')) return v

  // If it's an uploads/storage path, resolve against FILES_BASE
  if (v.startsWith('/uploads/') || v.startsWith('/storage/') || v.startsWith('/files/')) {
    return joinUrl(FILES_BASE, v)
  }

  // Otherwise, try to resolve as a relative file path on the backend.
  return joinUrl(FILES_BASE, v)
}

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
    storage.remove('token')
    storage.remove('user')
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
