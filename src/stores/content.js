import { defineStore } from 'pinia'
import { apiFetch } from '../utils/api'

const norm = (s) => String(s || '').toLowerCase()

export const useContentStore = defineStore('content', {
  state: () => ({
    banks: [],
    bank: null, // active bank with questions
    pastQuestions: [],
    materials: [],
    loading: {
      banks: false,
      bank: false,
      pastQuestions: false,
      materials: false,
    },
    error: null,
    lastCourseId: '', // helps dashboard / refetch logic if you want it
  }),

  getters: {
    bankById: (s) => (id) => (s.banks || []).find((b) => b.id === id) || null,

    // Heuristic: prefer "core", else mid-length, else shortest
    recommendedBank: (s) => {
      const list = Array.isArray(s.banks) ? s.banks : []
      if (!list.length) return null

      const core = list.find((b) => norm(b.title).includes('core'))
      if (core) return core

      const mid = list
        .filter((b) => {
          const n = Number(b.questionCount ?? b.questions?.length ?? 0)
          return n >= 20 && n <= 40
        })
        .sort((a, b) => {
          const na = Number(a.questionCount ?? a.questions?.length ?? 0)
          const nb = Number(b.questionCount ?? b.questions?.length ?? 0)
          return na - nb
        })[0]
      if (mid) return mid

      return [...list].sort((a, b) => {
        const na = Number(a.questionCount ?? a.questions?.length ?? 0)
        const nb = Number(b.questionCount ?? b.questions?.length ?? 0)
        return na - nb
      })[0]
    },
  },

  actions: {
    async fetchBanks({ courseId = '' } = {}) {
      this.loading.banks = true
      this.error = null
      this.lastCourseId = courseId || ''
      try {
        const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
        const res = await apiFetch(`/banks${qs}`)
        this.banks = res?.data?.banks || []
      } catch (e) {
        this.error = e?.message || 'Failed to load banks'
      } finally {
        this.loading.banks = false
      }
    },

    async fetchBank(bankId) {
      this.loading.bank = true
      this.error = null
      try {
        const res = await apiFetch(`/banks/${encodeURIComponent(bankId)}`)
        const bank = res?.data?.bank || null

        // Normalize question shape (backend may send legacy prompt/explain)
        if (bank?.questions?.length) {
          bank.questions = bank.questions.map((q) => ({
            ...q,
            answerIndex: typeof q.answerIndex === 'string' ? Number(q.answerIndex) : q.answerIndex,
            question: q.question ?? q.prompt ?? '',
            explanation: q.explanation ?? q.explain ?? '',
          }))
        }

        this.bank = bank
      } catch (e) {
        this.error = e?.message || 'Failed to load bank'
        this.bank = null
      } finally {
        this.loading.bank = false
      }
    },

    async fetchPastQuestions({ courseId = '' } = {}) {
      this.loading.pastQuestions = true
      this.error = null
      try {
        const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
        const res = await apiFetch(`/pastquestions${qs}`)
        this.pastQuestions = res?.data?.pastQuestions || []
      } catch (e) {
        this.error = e?.message || 'Failed to load past questions'
        this.pastQuestions = []
      } finally {
        this.loading.pastQuestions = false
      }
    },

    async fetchMaterials({ courseId = '' } = {}) {
      this.loading.materials = true
      this.error = null
      try {
        const qs = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
        const res = await apiFetch(`/materials${qs}`)
        this.materials = res?.data?.materials || []
      } catch (e) {
        this.error = e?.message || 'Failed to load materials'
        this.materials = []
      } finally {
        this.loading.materials = false
      }
    }
  }
})
