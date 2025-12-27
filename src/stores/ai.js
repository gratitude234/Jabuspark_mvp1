import { defineStore } from 'pinia'
import { apiFetch } from '../utils/api'

export const useAiStore = defineStore('ai', {
  state: () => ({
    loading: {
      explain: false,
      generateBank: false,
    },
    error: null,
    cache: {
      // key: `${questionId}:${mode}` -> result
    }
  }),
  actions: {
    async explainMCQ({ bankId, questionId, mode = 'full', selectedIndex = null }) {
      const key = `${questionId}:${mode}`
      if (this.cache[key]) return this.cache[key]

      this.loading.explain = true
      this.error = null
      try {
        const res = await apiFetch('/ai/explain-mcq', {
          method: 'POST',
          body: { bankId, questionId, mode, selectedIndex },
        })
        const out = res?.data?.result || null
        if (out) this.cache[key] = out
        return out
      } catch (e) {
        this.error = e?.message || 'AI request failed'
        throw e
      } finally {
        this.loading.explain = false
      }
    },

    async generateBank({ courseId, topic = '', difficulty = 'mixed', count = 8 }) {
      this.loading.generateBank = true
      this.error = null
      try {
        const res = await apiFetch('/ai/generate-bank', {
          method: 'POST',
          body: { courseId, topic, difficulty, count },
        })
        return res?.data || null
      } catch (e) {
        this.error = e?.message || 'AI request failed'
        throw e
      } finally {
        this.loading.generateBank = false
      }
    }
  }
})
