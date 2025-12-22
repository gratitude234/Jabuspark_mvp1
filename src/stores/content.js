import { defineStore } from 'pinia'
import { apiFetch } from '../utils/api'

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
        this.bank = res?.data?.bank || null
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
