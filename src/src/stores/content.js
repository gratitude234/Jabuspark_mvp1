import { defineStore } from 'pinia'
import { apiFetch, resolveFileUrl } from '../utils/api'

function normalizeDoc(item) {
  const url = item?.fileUrl || item?.url || item?.file_url || item?.path || ''
  return { ...item, fileUrl: resolveFileUrl(url) }
}

export const useContentStore = defineStore('content', {
  state: () => ({
    banks: [],
    bank: null,
    pastQuestions: [],
    materials: [],
    loading: {
      banks: false,
      bank: false,
      pastQuestions: false,
      materials: false,
    },
    error: null
  }),
  actions: {
    async fetchBanks({ courseId = '' } = {}) {
      this.loading.banks = true
      this.error = null
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
        this.pastQuestions = (res?.data?.pastQuestions || []).map(normalizeDoc)
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
        this.materials = (res?.data?.materials || []).map(normalizeDoc)
      } catch (e) {
        this.error = e?.message || 'Failed to load materials'
        this.materials = []
      } finally {
        this.loading.materials = false
      }
    }
  }
})
