import { defineStore } from 'pinia'
import { storage } from '../utils/storage'
import { apiFetch } from '../utils/api'

const seed = () => ({
  progress: {
    streak: 0,
    accuracy: 0,
    totalAnswered: 0,
    correctAnswered: 0,
    studySeconds: 0,
    lastActive: null,
    saved: { pastQuestions: [], materials: [], questions: [] },
  },
  answers: {}, // { [bankId]: { answeredIds:[], correctIds:[] } }
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
      }
      if (bankStats) {
        this.answers = { ...this.answers, [bankId]: bankStats }
        storage.set('answers', this.answers)
      }
      return res?.data
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
