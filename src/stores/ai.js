import { defineStore } from 'pinia'
import { apiFetch } from '../utils/api'

export const useAiStore = defineStore('ai', {
  state: () => ({
    loading: {
      explain: false,
      generateBank: false,
      theoryCoach: false,
      docChat: false,
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
    },

    async theoryCoach({ bankId, questionId, mode = 'hint', answerText = '', includeScore = true, attemptId = '' } = {}) {
      if (!bankId || !questionId) throw new Error('Missing theory question reference')
      const m = String(mode || 'hint').toLowerCase()
      if (!['hint', 'feedback'].includes(m)) throw new Error('Invalid AI coach mode')

      if (m === 'feedback') {
        const a = (answerText || '').trim()
        if (!a) throw new Error('Write an answer first to get feedback')
      }

      this.loading.theoryCoach = true
      this.error = null
      try {
        const res = await apiFetch('/ai/theory-coach', {
          method: 'POST',
          body: {
            bankId,
            questionId,
            mode: m,
            answerText: (answerText || '').trim(),
            includeScore: !!includeScore,
            attemptId: attemptId || '',
          },
        })
        return res?.data || null
      } catch (e) {
        this.error = e?.message || 'AI request failed'
        throw e
      } finally {
        this.loading.theoryCoach = false
      }
    },

    async docChat({ docType, docId, question }) {
      if (!docType || !docId) throw new Error('Missing document reference')
      const q = (question || '').trim()
      if (!q) throw new Error('Type a question first')

      this.loading.docChat = true
      this.error = null
      try {
        const res = await apiFetch('/ai/doc-chat', { method: 'POST', body: { docType, docId, question: q } })
        return res?.data
      } catch (e) {
        this.error = e?.message || 'AI request failed'
        throw e
      } finally {
        this.loading.docChat = false
      }
    }

  }
})
