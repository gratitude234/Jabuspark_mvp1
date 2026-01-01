<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()

const facultyId = ref(auth.user?.profile?.facultyId || null)
const departmentId = ref(auth.user?.profile?.departmentId || null)
const level = ref(auth.user?.profile?.level || 200)

// Extra (carryover/electives) picked by the user
const extraCourseIds = ref([])

const busy = ref(false)
const error = ref('')

// Carryover search
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

// Department+level default courses (auto-included)
const baseCourses = computed(() => catalog.deptCourses || [])
const baseCourseIds = computed(() => baseCourses.value.map(c => c.id))

const selectedCourseIds = computed(() => {
  const set = new Set([...baseCourseIds.value, ...extraCourseIds.value])
  return [...set]
})

const selectedExtras = computed(() => {
  const base = new Set(baseCourseIds.value)
  const ids = extraCourseIds.value.filter(id => !base.has(id))
  const byId = new Map((catalog.courses || []).map(c => [c.id, c]))
  return ids.map(id => byId.get(id)).filter(Boolean)
})

const extraOptions = computed(() => {
  const q = courseQuery.value.trim().toLowerCase()
  const base = new Set(baseCourseIds.value)
  const selected = new Set(selectedCourseIds.value)

  // only show courses not in base + not already selected
  let list = (catalog.courses || []).filter(c => !base.has(c.id) && !selected.has(c.id))

  if (!q) return list.slice(0, 20)

  list = list.filter(c => (`${c.code} ${c.title}`.toLowerCase().includes(q)))
  return list.slice(0, 20)
})

const canContinue = computed(() =>
  Boolean(facultyId.value && departmentId.value && level.value) && !busy.value
)

function addExtraCourse(id) {
  if (!id) return
  if (extraCourseIds.value.includes(id)) return
  extraCourseIds.value.push(id)
}

function removeExtraCourse(id) {
  extraCourseIds.value = extraCourseIds.value.filter(x => x !== id)
}

watch(facultyId, async (next) => {
  error.value = ''
  departmentId.value = null
  extraCourseIds.value = []
  courseQuery.value = ''
  catalog.deptCourses = []

  if (!next) return
  await catalog.fetchDepartments({ facultyId: next })
})

watch([departmentId, level], async ([dept, lvl]) => {
  error.value = ''
  extraCourseIds.value = []
  courseQuery.value = ''
  catalog.deptCourses = []

  if (!dept) return
  await catalog.fetchDeptCourses({ departmentId: dept, level: Number(lvl) || 0 })
})

onMounted(async () => {
  error.value = ''
  await catalog.bootstrap()

  // Load the full course catalog for carryover search
  await catalog.fetchCourses()

  if (facultyId.value) {
    await catalog.fetchDepartments({ facultyId: facultyId.value })
  }

  if (departmentId.value) {
    await catalog.fetchDeptCourses({
      departmentId: departmentId.value,
      level: Number(level.value) || 0,
    })
  }
})

async function save() {
  error.value = ''

  if (!facultyId.value) return (error.value = 'Choose a faculty to continue.')
  if (!departmentId.value) return (error.value = 'Choose a department to continue.')
  if (!level.value) return (error.value = 'Choose your level to continue.')

  // If no courses exist yet, don't "fail" the user — send them to request + suggest GNS.
  if (baseCourseIds.value.length === 0) {
    router.push({
      path: '/onboarding/request-department',
      query: {
        facultyId: String(facultyId.value || ''),
        departmentId: String(departmentId.value || ''),
        level: String(Number(level.value) || 0),
      }
    })
    return
  }

  busy.value = true
  try {
    await auth.updateProfile({
      facultyId: facultyId.value,
      departmentId: departmentId.value,
      level: Number(level.value),
      // Always include all base courses + any carryovers
      courseIds: selectedCourseIds.value,
    })

    const rawNext = route.query?.next
    const nextPath = typeof rawNext === 'string' && rawNext.startsWith('/') ? rawNext : ''
    router.push(nextPath || '/dashboard')
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
      <div class="row">
        <div>
          <div class="text-xs text-text-3">Onboarding</div>
          <div class="h1 mt-1">Department setup (optional)</div>
          <p class="sub mt-2 max-w-[62ch]">
            Department content is being added step-by-step. If your department courses aren’t available yet, start with <b>GNS Exam Prep</b>
            and come back later.
          </p>
        </div>
        <RouterLink to="/onboarding" class="btn btn-ghost">Back</RouterLink>
      </div>

      <div class="mt-4 flex flex-col sm:flex-row gap-2">
        <RouterLink to="/onboarding/gns" class="btn btn-primary">Start GNS Exam Prep</RouterLink>
        <RouterLink to="/onboarding/request-department" class="btn btn-ghost">Request my department</RouterLink>
      </div>

      <div class="grid gap-4 mt-6 sm:grid-cols-3">
        <div class="sm:col-span-1">
          <label class="label">Faculty</label>
          <AppSelect v-model="facultyId" :options="facultyOptions" placeholder="Select faculty…" />
          <p v-if="catalog.loading?.faculties" class="help" role="status" aria-live="polite">Loading faculties…</p>
        </div>

        <div class="sm:col-span-1">
          <label class="label">Department</label>
          <AppSelect
            v-model="departmentId"
            :options="departmentOptions"
            placeholder="Select department…"
            :disabled="!facultyId || catalog.loading?.departments || busy"
          />
          <p v-if="!facultyId" class="help">Choose a faculty first.</p>
          <p v-else-if="catalog.loading?.departments" class="help" role="status" aria-live="polite">Loading departments…</p>
        </div>

        <div class="sm:col-span-1">
          <label class="label">Level</label>
          <AppSelect v-model="level" :options="levelOptions" placeholder="Select level…" />
        </div>
      </div>

      <div class="divider my-6"></div>

      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="h2">Your department courses</div>
          <p class="sub mt-1">These are auto-added based on your department and level.</p>
        </div>
        <div class="text-right">
          <div class="text-xs text-text-3">Auto-added</div>
          <div class="text-sm font-semibold">{{ baseCourseIds.length }}</div>
        </div>
      </div>

      <div class="mt-3">
        <div v-if="!departmentId" class="alert alert-ok" role="status">
          Select a department and level to load your default courses.
        </div>

        <div v-else-if="catalog.loading?.deptCourses" class="sub" role="status" aria-live="polite">
          Loading courses…
        </div>

        <div v-else-if="baseCourses.length === 0" class="alert alert-warn" role="status">
          <div class="font-semibold">Not available yet (coming soon)</div>
          <div class="text-xs mt-1 opacity-80">
            Your department courses haven’t been uploaded yet. You can still use <b>GNS Exam Prep</b> right now,
            or request your department so we prioritise it.
          </div>
          <div class="mt-3 flex flex-col sm:flex-row gap-2">
            <RouterLink to="/onboarding/gns" class="btn btn-primary">Start GNS now</RouterLink>
            <RouterLink to="/onboarding/request-department" class="btn btn-ghost">Request my department</RouterLink>
          </div>
        </div>

        <div v-else class="grid gap-2 sm:grid-cols-2">
          <div
            v-for="c in baseCourses"
            :key="c.id"
            class="card card-pad text-left border border-border/70 bg-surface/60"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-semibold">{{ c.code }} — {{ c.title }} ({{ c.level }})</div>
              <span class="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent">Included</span>
            </div>
            <div class="text-xs text-text-3 mt-1">Auto-added (locked)</div>
          </div>
        </div>
      </div>

      <div class="divider my-6"></div>

      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="h2">Carryovers / extra courses</div>
          <p class="sub mt-1">Add any other courses you want access to.</p>
        </div>
        <div class="text-right">
          <div class="text-xs text-text-3">Extras</div>
          <div class="text-sm font-semibold">{{ selectedExtras.length }}</div>
        </div>
      </div>

      <div class="mt-3">
        <input
          v-model="courseQuery"
          class="input w-full"
          type="text"
          placeholder="Search course code or title…"
          :disabled="busy"
        />

        <div v-if="selectedExtras.length" class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="c in selectedExtras"
            :key="c.id"
            type="button"
            class="pill"
            @click="removeExtraCourse(c.id)"
            :disabled="busy"
            title="Remove"
          >
            {{ c.code }} <span class="opacity-70">×</span>
          </button>
        </div>

        <div class="mt-3">
          <div v-if="extraOptions.length === 0" class="help">
            {{ courseQuery ? 'No courses match your search.' : 'Search to add carryover courses.' }}
          </div>

          <div v-else class="grid gap-2 sm:grid-cols-2 mt-2">
            <button
              v-for="c in extraOptions"
              :key="c.id"
              type="button"
              class="card card-press card-pad text-left"
              :disabled="busy"
              @click="addExtraCourse(c.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="text-sm font-semibold">{{ c.code }} — {{ c.title }} ({{ c.level }})</div>
                <span class="badge">+</span>
              </div>
              <div class="text-xs text-text-3 mt-1">Tap to add</div>
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger mt-4" role="alert" aria-live="assertive">
        {{ error }}
      </div>

      <div class="mt-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div class="text-xs text-text-3">
          Total courses: <b>{{ selectedCourseIds.length }}</b> (department + extras)
        </div>

        <AppButton class="w-full sm:w-auto" :disabled="!canContinue" @click="save">
          <span v-if="!busy">Finish setup</span>
          <span v-else>Saving…</span>
        </AppButton>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
.pill {
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 9999px;
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
}
</style>
