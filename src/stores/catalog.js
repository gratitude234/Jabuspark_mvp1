import { defineStore } from 'pinia'
import { apiFetch } from '../utils/api'

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    faculties: [],
    departments: [],

    // All courses (used across the app for dropdowns/search)
    courses: [],

    // Department+level courses (used for onboarding defaults)
    deptCourses: [],

    loading: {
      faculties: false,
      departments: false,
      courses: false,
      deptCourses: false,
    },
    error: null,
  }),
  actions: {
    async fetchFaculties() {
      this.error = null
      this.loading.faculties = true
      try {
        const res = await apiFetch('/catalog/faculties')
        this.faculties = res?.data?.faculties || []
      } catch (e) {
        this.error = e?.message || 'Failed to load faculties'
      } finally {
        this.loading.faculties = false
      }
    },

    async fetchDepartments({ facultyId = '' } = {}) {
      this.error = null
      this.loading.departments = true
      try {
        const qs = facultyId ? `?facultyId=${encodeURIComponent(facultyId)}` : ''
        const res = await apiFetch(`/catalog/departments${qs}`)
        this.departments = res?.data?.departments || []
      } catch (e) {
        this.error = e?.message || 'Failed to load departments'
      } finally {
        this.loading.departments = false
      }
    },

    /**
     * Fetch courses for general app usage.
     * When called without filters, it returns the full course catalog.
     */
    async fetchCourses({ departmentId = '', level = 0 } = {}) {
      this.error = null
      this.loading.courses = true
      try {
        const params = new URLSearchParams()
        if (departmentId) params.set('departmentId', departmentId)
        if (level) params.set('level', String(level))
        const qs = params.toString() ? `?${params}` : ''
        const res = await apiFetch(`/catalog/courses${qs}`)
        this.courses = res?.data?.courses || []
      } catch (e) {
        this.error = e?.message || 'Failed to load courses'
      } finally {
        this.loading.courses = false
      }
    },

    /**
     * Fetch department+level courses used as the user's default course set.
     * Does NOT overwrite the full catalog list in `courses`.
     */
    async fetchDeptCourses({ departmentId = '', level = 0 } = {}) {
      this.error = null
      this.loading.deptCourses = true
      try {
        const params = new URLSearchParams()
        if (departmentId) params.set('departmentId', departmentId)
        if (level) params.set('level', String(level))
        const qs = params.toString() ? `?${params}` : ''
        const res = await apiFetch(`/catalog/courses${qs}`)
        this.deptCourses = res?.data?.courses || []
      } catch (e) {
        this.error = e?.message || 'Failed to load department courses'
      } finally {
        this.loading.deptCourses = false
      }
    },

    // convenience: initial load
    async bootstrap() {
      if (this.faculties.length) return
      await this.fetchFaculties()
    }
  }
})
