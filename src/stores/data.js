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

    // ✅ upgraded: object for “Continue”
    // { bankId, questionId, updatedAt }
    lastActive: null,

    saved: { pastQuestions: [], materials: [], questions: [] },
  },
  answers: {}, // { [bankId]: { answeredIds:[], correctIds:[] } }
})

const nowISO = () => new Date().toISOString()

function normalizeLastActive(v) {
  if (!v) return null
  if (typeof v === 'object' && v.bankId) {
    return {
      bankId: String(v.bankId),
      questionId: v.questionId ? String(v.questionId) : null,
      updatedAt: v.updatedAt ? String(v.updatedAt) : null,
    }
  }
  return null
}

function safeArr(x) {
  return Array.isArray(x) ? x : []
}

function bankWrongIds(bankStats) {
  const answered = new Set(safeArr(bankStats?.answeredIds).map(String))
  const correct = new Set(safeArr(bankStats?.correctIds).map(String))
  const wrong = []
  for (const id of answered) if (!correct.has(id)) wrong.push(id)
  return wrong
}

export const useDataStore = defineStore('data', {
  state: () => ({
    ...seed(),
    loading: {
      progress: false,
    },
    error: null,
  }),

  getters: {
    // ✅ Single source of truth for “Saved” pill on dashboard
    savedCount: (s) => {
      const saved = s.progress.saved || {}
      return (
        safeArr(saved.pastQuestions).length +
        safeArr(saved.materials).length +
        safeArr(saved.questions).length
      )
    },

    // ✅ Total wrong across all banks (drives “Review wrong answers” CTA)
    totalWrongCount: (s) => {
      const answers = s.answers || {}
      let total = 0
      for (const bankId of Object.keys(answers)) {
        total += bankWrongIds(answers[bankId]).length
      }
      return total
    },

    // ✅ Wrong IDs for a specific bank (useful for a review page)
    wrongIdsForBank: (s) => (bankId) => {
      const stats = s.answers?.[bankId]
      return bankWrongIds(stats)
    },
  },

  actions: {
    async bootstrap() {
      // prefer server, fallback to storage if offline
      const cached = storage.get('progress', null)
      const cachedAns = storage.get('answers', null)

      if (cached) {
        this.progress = { ...seed().progress, ...cached }
        this.progress.lastActive = normalizeLastActive(this.progress.lastActive)
      }
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

        // ✅ normalize lastActive so dashboard can rely on shape
        this.progress.lastActive = normalizeLastActive(this.progress.lastActive)

        storage.set('progress', this.progress)
        storage.set('answers', this.answers)
      } catch (e) {
        this.error = e?.message || 'Failed to load progress'
        // keep cached data if available
      } finally {
        this.loading.progress = false
      }
    },

    // ✅ allows pages to set lastActive even if API doesn’t return it
    setLastActive({ bankId, questionId = null }) {
      this.progress.lastActive = {
        bankId: String(bankId),
        questionId: questionId ? String(questionId) : null,
        updatedAt: nowISO(),
      }
      storage.set('progress', this.progress)
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
      // ✅ optimistic lastActive so dashboard shows “Continue” immediately
      if (bankId) {
        this.setLastActive({ bankId, questionId })
      }

      const res = await apiFetch('/practice/submit', {
        method: 'POST',
        body: { bankId, questionId, selectedIndex, secondsSpent }
      })

      const p = res?.data?.progress
      const bankStats = res?.data?.bankStats

      if (p) {
        this.progress = { ...this.progress, ...p }
        this.progress.lastActive = normalizeLastActive(this.progress.lastActive) || this.progress.lastActive
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

      // Optional: if they reset the bank they were last active in, clear lastActive
      if (this.progress.lastActive?.bankId === bankId) {
        this.progress.lastActive = null
        storage.set('progress', this.progress)
      }

      return true
    }
  }
})
