// src/stores/auth.js
import { defineStore } from 'pinia'
import { storage } from '../utils/storage'
import { apiFetch } from '../utils/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: storage.get('token', null),
    user: storage.get('user', null),
    bootstrapped: false,
  }),

  getters: {
    isAuthed: (s) => !!s.token && !!s.user,

    profile: (s) => s.user?.profile || {},

    role: (s) => s.user?.role || 'student',

    // Upload workflow helpers (used by router/pages)
    uploadsDisabled: (s) => {
      const u = s.user || {}
      const p = u.profile || {}
      return Boolean(
        u.uploadsDisabled ??
          u.uploads_disabled ??
          p.uploadsDisabled ??
          p.uploads_disabled ??
          false
      )
    },

    // For the “perfect workflow”: profile must be saved before reps request uploads
    hasSavedStudySetup: (s) => {
      if (!s.user) return false
      const p = s.user.profile || {}
      const nameOk = String(s.user.fullName || '').trim().length > 0
      return Boolean(nameOk && p.facultyId && p.departmentId && p.level)
    },

    // Can open /uploads
    canUpload: (s) => {
      const role = s.user?.role || 'student'
      if (role === 'admin') return true
      if (role !== 'course_rep') return false
      const u = s.user || {}
      const p = u.profile || {}
      const disabled = Boolean(
        u.uploadsDisabled ??
          u.uploads_disabled ??
          p.uploadsDisabled ??
          p.uploads_disabled ??
          false
      )
      return !disabled
    },

    // Onboarding is considered complete once the user has:
    // 1) a level, and
    // 2) at least one selected course
    // (GNS users don't need a department; handled elsewhere via onboarding choice)
    needsOnboarding: (s) => {
      if (!s.user) return false
      const p = s.user.profile || {}
      const level = Number(p.level || 0)
      const courseIds = Array.isArray(p.courseIds) ? p.courseIds : []
      return level <= 0 || courseIds.length === 0
    },
  },

  actions: {
    // ---- internal helpers ----
    _persist() {
      storage.set('token', this.token)
      storage.set('user', this.user)
    },

    _clearSession() {
      this.token = null
      this.user = null
      storage.remove('token')
      storage.remove('user')
      storage.remove('progress')
      storage.remove('answers')
    },

    // called once on app start
    async hydrate() {
      if (this.bootstrapped) return
      this.bootstrapped = true

      // apiFetch should dispatch 'auth:expired' on 401; this is a safe fallback
      const onExpired = () => {
        this._clearSession()
      }
      window.addEventListener('auth:expired', onExpired, { once: false })

      if (!this.token) return

      try {
        await this.refreshMe()
      } catch {
        // If refresh fails, apiFetch may already clear; ensure local is consistent
        this.token = storage.get('token', null)
        this.user = storage.get('user', null)
        if (!this.token || !this.user) this._clearSession()
      }
    },

    // Optional: allow other parts of app to force-set session
    setSession({ token, user }) {
      this.token = token || null
      this.user = user || null
      if (!this.token || !this.user) {
        this._clearSession()
        return
      }
      this._persist()
    },

    async register({ fullName, email, password }) {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: { fullName, email, password },
      })

      const token = res?.data?.token
      const user = res?.data?.user
      if (!token || !user) throw new Error('Invalid response from server')

      this.setSession({ token, user })
      return user
    },

    async login({ email, password }) {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      })

      const token = res?.data?.token
      const user = res?.data?.user
      if (!token || !user) throw new Error('Invalid response from server')

      this.setSession({ token, user })
      return user
    },

    async logout() {
      try {
        if (this.token) await apiFetch('/auth/logout', { method: 'POST' })
      } catch {
        // ignore
      } finally {
        this._clearSession()
      }
    },

    // ✅ Source of truth refresh (used after approve/assign so UI unlocks instantly)
    async refreshMe() {
      const res = await apiFetch('/me')
      const user = res?.data?.user
      if (!user) throw new Error('Failed to load profile')
      this.user = user
      storage.set('user', user)
      return user
    },

    // Best-effort refresh (never throws)
    async refreshMeSafe() {
      try {
        return await this.refreshMe()
      } catch {
        return this.user
      }
    },

    async updateProfile(patch) {
      if (!this.user) throw new Error('Not authenticated')
      const res = await apiFetch('/me/profile', { method: 'PATCH', body: patch })
      const user = res?.data?.user
      if (!user) throw new Error('Profile update failed')
      this.user = user
      storage.set('user', user)
      return user
    },
  },
})
