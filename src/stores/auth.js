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
    role: (s) => s.user?.role || 'student',
    isAdmin: (s) => (s.user?.role || 'student') === 'admin',
    isCourseRep: (s) => (s.user?.role || 'student') === 'course_rep',
    uploadsDisabled: (s) => {
      const u = s.user || {}
      const p = u.profile || {}
      // backend may expose this on user or profile (optional)
      const v = u.uploadsDisabled ?? u.uploads_disabled ?? p.uploadsDisabled ?? p.uploads_disabled
      return !!v
    },
    // Onboarding is considered complete once the user has:
    // 1) a level, and
    // 2) at least one selected course (GNS users don't need a department)
    needsOnboarding: (s) => {
      if (!s.user) return false
      const p = s.user.profile || {}
      const level = Number(p.level || 0)
      const courseIds = Array.isArray(p.courseIds) ? p.courseIds : []
      return level <= 0 || courseIds.length === 0
    }
  },
  actions: {
    setUser(user) {
      this.user = user
      storage.set('user', user)
    },

    async hydrate() {
      // called once on app start
      if (this.bootstrapped) return
      this.bootstrapped = true

      const onExpired = () => {
        this.token = null
        this.user = null
      }
      window.addEventListener('auth:expired', onExpired, { once: false })

      if (!this.token) return
      try {
        await this.refreshMe()
      } catch (e) {
        // invalid token -> cleared by apiFetch
        this.token = storage.get('token', null)
        this.user = storage.get('user', null)
      }
    },

    async register({ fullName, email, password }) {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: { fullName, email, password }
      })
      const token = res?.data?.token
      const user = res?.data?.user
      if (!token || !user) throw new Error('Invalid response from server')
      this.token = token
      this.setUser(user)
      storage.set('token', token)
      return user
    },

    async login({ email, password }) {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password }
      })
      const token = res?.data?.token
      const user = res?.data?.user
      if (!token || !user) throw new Error('Invalid response from server')
      this.token = token
      this.setUser(user)
      storage.set('token', token)
      return user
    },

    async logout() {
      try {
        if (this.token) await apiFetch('/auth/logout', { method: 'POST' })
      } catch {
        // ignore
      } finally {
        this.token = null
        this.user = null
        storage.remove('token')
        storage.remove('user')
        storage.remove('progress')
        storage.remove('answers')
      }
    },

    async refreshMe() {
      const res = await apiFetch('/me')
      const user = res?.data?.user
      if (!user) throw new Error('Failed to load profile')
      this.setUser(user)
      return user
    },

    async updateProfile(patch) {
      if (!this.user) return
      const res = await apiFetch('/me/profile', { method: 'PATCH', body: patch })
      const user = res?.data?.user
      if (!user) throw new Error('Profile update failed')
      this.setUser(user)
      return user
    }
  }
})
