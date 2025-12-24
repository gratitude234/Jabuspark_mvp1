<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()

const facultyId = ref(auth.user?.profile?.facultyId || null)
const departmentId = ref(auth.user?.profile?.departmentId || null)
const level = ref(auth.user?.profile?.level || 200)
const pickedCourseIds = ref([...(auth.user?.profile?.courseIds || [])])

const busy = ref(false)
const error = ref('')

// Course search
const courseQuery = ref('')

const levelOptions = [
  { value: 100, label: '100 Level' },
  { value: 200, label: '200 Level' },
  { value: 300, label: '300 Level' },
  { value: 400, label: '400 Level' },
  { value: 500, label: '500 Level' },
  { value: 600, label: '600 Level' },
]

const facultyOptions = computed(() =>
  (catalog.faculties || []).map(f => ({ value: f.id, label: f.name }))
)

const departmentOptions = computed(() =>
  (catalog.departments || []).map(d => ({ value: d.id, label: d.name }))
)

const courseOptions = computed(() =>
  (catalog.courses || []).map(c => ({
    id: c.id,
    code: c.code,
    title: c.title,
    level: c.level,
    label: `${c.code} — ${c.title}${c.level ? ` (${c.level})` : ''}`,
  }))
)

const filteredCourseOptions = computed(() => {
  const q = courseQuery.value.trim().toLowerCase()
  if (!q) return courseOptions.value
  return courseOptions.value.filter(c =>
    `${c.code} ${c.title} ${c.label}`.toLowerCase().includes(q)
  )
})

const selectedCount = computed(() => pickedCourseIds.value.length)

const departmentDisabled = computed(() =>
  !facultyId.value || catalog.loading?.departments || busy.value
)

const coursesEnabled = computed(() =>
  Boolean(departmentId.value && level.value) && !catalog.loading?.courses
)

const canContinue = computed(() =>
  Boolean(facultyId.value && departmentId.value && level.value) && !busy.value
)

function toggleCourse(id) {
  const idx = pickedCourseIds.value.indexOf(id)
  if (idx >= 0) pickedCourseIds.value.splice(idx, 1)
  else pickedCourseIds.value.push(id)
}

function clearCourses() {
  pickedCourseIds.value = []
}

function toggleAllShown() {
  const shownIds = filteredCourseOptions.value.map(c => c.id)
  if (shownIds.length === 0) return

  const allSelected = shownIds.every(id => pickedCourseIds.value.includes(id))
  if (allSelected) {
    pickedCourseIds.value = pickedCourseIds.value.filter(id => !shownIds.includes(id))
  } else {
    const set = new Set(pickedCourseIds.value)
    shownIds.forEach(id => set.add(id))
    pickedCourseIds.value = [...set]
  }
}

watch(facultyId, async (next) => {
  error.value = ''
  departmentId.value = null
  pickedCourseIds.value = []
  courseQuery.value = ''

  if (!next) return
  await catalog.fetchDepartments({ facultyId: next })
})

watch([departmentId, level], async ([dept, lvl]) => {
  error.value = ''
  pickedCourseIds.value = []
  courseQuery.value = ''

  if (!dept) return
  await catalog.fetchCourses({ departmentId: dept, level: Number(lvl) || 0 })
})

onMounted(async () => {
  error.value = ''
  await catalog.bootstrap()

  if (facultyId.value) {
    await catalog.fetchDepartments({ facultyId: facultyId.value })
  }

  if (departmentId.value) {
    await catalog.fetchCourses({
      departmentId: departmentId.value,
      level: Number(level.value) || 0,
    })
  }
})

async function save({ skipCourses = false } = {}) {
  error.value = ''

  if (!facultyId.value) return (error.value = 'Choose a faculty to continue.')
  if (!departmentId.value) return (error.value = 'Choose a department to continue.')
  if (!level.value) return (error.value = 'Choose your level to continue.')

  busy.value = true
  try {
    await auth.updateProfile({
      facultyId: facultyId.value,
      departmentId: departmentId.value,
      level: Number(level.value),
      courseIds: skipCourses ? [] : pickedCourseIds.value,
    })

    router.push('/dashboard')
  } catch (e) {
    error.value = e?.message || 'Failed to save. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppCard class="max-w-3xl mx-auto">
      <div class="text-xs text-text-3">Step 1 of 2</div>
      <div class="h1 mt-1">Set up your study profile</div>
      <p class="sub mt-2">
        This helps JabuSpark show the right materials and practice banks.
      </p>

      <div class="grid gap-4 mt-6 sm:grid-cols-3">
        <div class="sm:col-span-1">
          <label class="label">Faculty</label>
          <AppSelect
            v-model="facultyId"
            :options="facultyOptions"
            placeholder="Select faculty…"
          />
          <p
            v-if="catalog.loading?.faculties"
            class="help"
            role="status"
            aria-live="polite"
          >
            Loading faculties…
          </p>
        </div>

        <div class="sm:col-span-1">
          <label class="label">Department</label>
          <AppSelect
            v-model="departmentId"
            :options="departmentOptions"
            placeholder="Select department…"
            :disabled="departmentDisabled"
          />
          <p v-if="!facultyId" class="help">Choose a faculty first.</p>
          <p
            v-else-if="catalog.loading?.departments"
            class="help"
            role="status"
            aria-live="polite"
          >
            Loading departments…
          </p>
        </div>

        <div class="sm:col-span-1">
          <label class="label">Level</label>
          <AppSelect
            v-model="level"
            :options="levelOptions"
            placeholder="Select level…"
          />
        </div>
      </div>

      <div class="divider my-6"></div>

      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="h2">Courses (optional)</div>
          <p class="sub mt-1">Pick now or skip and add them later in Profile.</p>
        </div>

        <div class="text-right">
          <div class="text-xs text-text-3">Selected</div>
          <div class="text-sm font-semibold">{{ selectedCount }}</div>
        </div>
      </div>

      <div class="mt-3">
        <div v-if="!departmentId" class="alert alert-ok" role="status">
          Select a department (and level) to load courses.
        </div>

        <div
          v-else-if="catalog.loading?.courses"
          class="sub"
          role="status"
          aria-live="polite"
        >
          Loading courses…
        </div>

        <div v-else>
          <div class="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-3">
            <input
              v-model="courseQuery"
              class="ui-input w-full sm:max-w-sm"
              type="text"
              placeholder="Search courses (code or title)…"
              :disabled="!coursesEnabled || busy"
            />

            <div class="flex gap-2">
              <button
                type="button"
                class="ui-btn ui-btn-ghost"
                :disabled="!filteredCourseOptions.length || busy"
                @click="toggleAllShown"
              >
                Toggle all shown
              </button>
              <button
                type="button"
                class="ui-btn ui-btn-ghost"
                :disabled="selectedCount === 0 || busy"
                @click="clearCourses"
              >
                Clear
              </button>
            </div>
          </div>

          <div v-if="filteredCourseOptions.length === 0" class="alert alert-ok" role="status">
            No courses match your search.
          </div>

          <div v-else class="grid gap-2 sm:grid-cols-2">
            <button
              v-for="c in filteredCourseOptions"
              :key="c.id"
              type="button"
              class="card card-press card-pad text-left"
              :class="pickedCourseIds.includes(c.id) ? 'ui-selected' : ''"
              :aria-pressed="pickedCourseIds.includes(c.id)"
              :disabled="busy"
              @click="toggleCourse(c.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="text-sm font-semibold">{{ c.label }}</div>
                <span
                  v-if="pickedCourseIds.includes(c.id)"
                  class="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent"
                >
                  Selected
                </span>
              </div>
              <div class="text-xs text-text-3 mt-1">
                {{ pickedCourseIds.includes(c.id) ? 'Tap to unselect' : 'Tap to select' }}
              </div>
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger mt-4" role="alert" aria-live="assertive">
        {{ error }}
      </div>

      <div class="mt-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div class="text-xs text-text-3">
          You can change this later in your profile.
        </div>

        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            class="ui-btn ui-btn-ghost w-full sm:w-auto"
            :disabled="busy"
            @click="save({ skipCourses: true })"
          >
            Pick courses later
          </button>

          <AppButton class="w-full sm:w-auto" :disabled="!canContinue" @click="save()">
            <span v-if="!busy">Continue</span>
            <span v-else>Saving…</span>
          </AppButton>
        </div>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
/* Minimal “nice defaults” that won't fight your design system.
   Remove if you already have equivalent utilities. */

.ui-input {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 0.75rem;
  padding: 0.6rem 0.75rem;
  outline: none;
}
.ui-input:focus {
  border-color: rgba(0, 0, 0, 0.3);
}

.ui-btn {
  border-radius: 0.75rem;
  padding: 0.55rem 0.8rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
}
.ui-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.ui-btn-ghost {
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: transparent;
}

.ui-selected {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.18);
}
</style>
