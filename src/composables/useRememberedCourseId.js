import { onMounted, ref, watch } from 'vue'
import { storage } from '../utils/storage'

/**
 * Persist a course selection and restore it on page load.
 *
 * - Stores only non-empty courseIds.
 * - Optionally validates restored/selected IDs against an allowed list.
 * - If the allowed list is not yet available (empty), validation is skipped until it is.
 */
export function useRememberedCourseId(
  storageKey,
  {
    getAllowedIds = null,
    defaultValue = null,
  } = {}
) {
  const courseId = ref(defaultValue)

  const allowedIds = () => {
    try {
      return typeof getAllowedIds === 'function' ? getAllowedIds() : null
    } catch {
      return null
    }
  }

  const isAllowed = (v) => {
    if (!v) return true
    const ids = allowedIds()
    if (!Array.isArray(ids) || ids.length === 0) return true
    return ids.includes(v)
  }

  onMounted(() => {
    const saved = storage.get(storageKey, null)
    if (typeof saved === 'string' && saved) {
      // Set first, then validate once course list loads.
      courseId.value = saved
    }
  })

  // Persist any user changes.
  watch(courseId, (v) => {
    if (v) storage.set(storageKey, v)
    else storage.remove(storageKey)
  })

  // Validate whenever the allowed list changes (e.g., after catalog fetch).
  watch(
    () => allowedIds(),
    (ids) => {
      if (!courseId.value) return
      if (!Array.isArray(ids) || ids.length === 0) return
      if (!ids.includes(courseId.value)) {
        courseId.value = null
      }
    }
  )

  // Validate current value immediately if we already have an allowed list.
  watch(
    courseId,
    (v) => {
      if (v && !isAllowed(v)) courseId.value = null
    },
    { flush: 'post' }
  )

  return courseId
}
