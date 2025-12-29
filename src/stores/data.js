import { defineStore } from 'pinia'
import { storage } from '../utils/storage'
import { apiFetch } from '../utils/api'
import { toast } from '../utils/toast'

const seed = () => ({
  progress: {
    streak: 0,
    accuracy: 0,
    totalAnswered: 0,
    correctAnswered: 0,
    studySeconds: 0,
    lastActive: null,
    // Gamification
    dailyGoal: 10,
    todayAnswered: 0,
    todayCorrect: 0,
    xp: 0,
    level: 1,
    badges: [],
    badgesNew: [],
    levelUp: false,
    saved: { pastQuestions: [], materials: [], questions: [] },
  },
  answers: {}, // { [bankId]: { answeredIds:[], correctIds:[] } }
  courseProgress: [],
  courseTrends: {}, // { [courseId]: [{date,attempts,accuracy}] }
  reviewQueue: [],
})

export const useDataStore = defineStore('data', {
  state: () => ({
    ...seed(),
    loading: {
      progress: false,
    },
    error: null,
  }),
  actions: {
    async bootstrap() {
      // prefer server, fallback to storage if offline
      const cached = storage.get('progress', null)
      const cachedAns = storage.get('answers', null)
      if (cached) this.progress = cached
      if (cachedAns) this.answers = cachedAns

      await this.fetchProgress()
    },

    async fetchProgress() {
      this.loading.progress = true
      this.error = null
      try {
        const res = await apiFetch('/progress')
        this.progress = res?.data?.progress || seed().progress
        this.answers = res?.data?.answers || {}
        storage.set('progress', this.progress)
        storage.set('answers', this.answers)
      } catch (e) {
        this.error = e?.message || 'Failed to load progress'
        // keep cached data if available
      } finally {
        this.loading.progress = false
      }
    },

    async toggleSave(kind, itemId) {
      const res = await apiFetch('/save/toggle', {
        method: 'POST',
        body: { kind, id: itemId }
      })
      const saved = !!res?.data?.saved

      const list = this.progress.saved?.[kind] || []
      const has = list.includes(itemId)
      if (saved && !has) list.push(itemId)
      if (!saved && has) {
        const idx = list.indexOf(itemId)
        if (idx >= 0) list.splice(idx, 1)
      }
      this.progress.saved = { ...this.progress.saved, [kind]: list }
      storage.set('progress', this.progress)
      return saved
    },

    async fetchCourseProgress() {
      const res = await apiFetch('/progress/courses')
      this.courseProgress = res?.data?.courses || []
      return this.courseProgress
    },

    async fetchCourseTrend(courseId, { days = 14 } = {}) {
      const qs = new URLSearchParams({ courseId: String(courseId || ''), days: String(days) })
      const res = await apiFetch(`/progress/trend?${qs.toString()}`)
      const pts = res?.data?.points || []
      this.courseTrends = { ...this.courseTrends, [courseId]: pts }
      return pts
    },

    async fetchReviewQueue({ courseId = '', limit = 25 } = {}) {
      const qs = new URLSearchParams({ limit: String(limit) })
      if (courseId) qs.set('courseId', courseId)
      const res = await apiFetch(`/practice/review?${qs.toString()}`)
      this.reviewQueue = res?.data?.questions || []
      return this.reviewQueue
    },

    isSaved(kind, itemId) {
      return (this.progress.saved?.[kind] || []).includes(itemId)
    },

    async submitAnswer({ bankId, questionId, selectedIndex, secondsSpent = 0 }) {
      const res = await apiFetch('/practice/submit', {
        method: 'POST',
        body: { bankId, questionId, selectedIndex, secondsSpent }
      })
      const p = res?.data?.progress
      const bankStats = res?.data?.bankStats

      if (p) {
        this.progress = { ...this.progress, ...p }
        storage.set('progress', this.progress)

        // Toasts for motivation (safe even if backend doesn't send these)
        if (p.levelUp) toast(`Level up! You are now Level ${p.level}.`, 'ok')
        if (Array.isArray(p.badgesNew) && p.badgesNew.length) {
          p.badgesNew.forEach((k) => toast(`Badge unlocked: ${k.replace(/_/g, ' ')}`, 'ok'))
        }
      }
      if (bankStats) {
        this.answers = { ...this.answers, [bankId]: bankStats }
        storage.set('answers', this.answers)
      }
      return res?.data
    },

    async setDailyGoal(dailyGoal) {
      const g = Math.max(5, Math.min(200, Number(dailyGoal) || 10))
      const res = await apiFetch('/gamification/goal', {
        method: 'POST',
        body: { dailyGoal: g }
      })

      // Update locally even if migration isn't run on server
      this.progress = { ...this.progress, dailyGoal: (res?.data?.dailyGoal ?? g) }
      storage.set('progress', this.progress)
      toast('Daily goal updated.', 'ok')
      return this.progress.dailyGoal
    },

    async resetBank(bankId) {
      await apiFetch('/practice/reset', { method: 'POST', body: { bankId } })
      const next = { ...this.answers }
      delete next[bankId]
      this.answers = next
      storage.set('answers', this.answers)
      return true
    }
  }
})
