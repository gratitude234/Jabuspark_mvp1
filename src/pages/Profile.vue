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

const user = computed(() => auth.user || {})
const profile = computed(() => user.value.profile || {})
const role = computed(() => user.value.role || 'student')

const fullName = ref(user.value.fullName || '')
const facultyId = ref(profile.value.facultyId || null)
const departmentId = ref(profile.value.departmentId || null)
const level = ref(profile.value.level || 200)

// Stored selection in DB (base + extras)
const pickedCourseIds = ref([...(profile.value.courseIds || [])])

// Carryover search
const courseQuery = ref('')

const busy = ref(false)
const error = ref('')
const savedOk = ref(false)

const levelOptions = [
  { value: 100, label: '100 Level' },
  { value: 200, label: '200 Level' },
  { value: 300, label: '300 Level' },
  { value: 400, label: '400 Level' },
  { value: 500, label: '500 Level' },
  { value: 600, label: '600 Level' },
]

const facultyOptions = computed(() => (catalog.faculties || []).map(f => ({ value: f.id, label: f.name })))
const departmentOptions = computed(() => (catalog.departments || []).map(d => ({ value: d.id, label: d.name })))

const baseCourses = computed(() => catalog.deptCourses || [])
const baseCourseIds = computed(() => baseCourses.value.map(c => c.id))

// Track previous base ids so we can preserve extras if department/level changes
const prevBaseIds = ref([])

const selectedCourseIds = computed(() => {
  const set = new Set([...baseCourseIds.value, ...pickedCourseIds.value])
  return [...set]
})

const selectedExtras = computed(() => {
  const base = new Set(baseCourseIds.value)
  const byId = new Map((catalog.courses || []).map(c => [c.id, c]))
  const extras = pickedCourseIds.value.filter(id => !base.has(id))
  return extras.map(id => byId.get(id)).filter(Boolean)
})

const extraOptions = computed(() => {
  const q = courseQuery.value.trim().toLowerCase()
  const base = new Set(baseCourseIds.value)
  const selected = new Set(selectedCourseIds.value)

  let list = (catalog.courses || []).filter(c => !base.has(c.id) && !selected.has(c.id))
  if (!q) return list.slice(0, 20)

  list = list.filter(c => (`${c.code} ${c.title}`.toLowerCase().includes(q)))
  return list.slice(0, 20)
})

function addExtraCourse(id) {
  if (!id) return
  if (pickedCourseIds.value.includes(id)) return
  pickedCourseIds.value.push(id)
}

function removeExtraCourse(id) {
  pickedCourseIds.value = pickedCourseIds.value.filter(x => x !== id)
}

async function refreshDeptCourses() {
  catalog.deptCourses = []
  if (!departmentId.value) return
  await catalog.fetchDeptCourses({ departmentId: departmentId.value, level: Number(level.value) || 0 })
}

watch(facultyId, async (next) => {
  departmentId.value = null
  courseQuery.value = ''
  savedOk.value = false
  if (!next) return
  await catalog.fetchDepartments({ facultyId: next })
})

watch([departmentId, level], async () => {
  savedOk.value = false
  courseQuery.value = ''

  const oldBase = new Set(prevBaseIds.value)
  const oldExtras = pickedCourseIds.value.filter(id => !oldBase.has(id))

  await refreshDeptCourses()

  // Ensure base courses are always included, preserve extras
  const set = new Set([...baseCourseIds.value, ...oldExtras])
  pickedCourseIds.value = [...set]
  prevBaseIds.value = [...baseCourseIds.value]
})

onMounted(async () => {
  await catalog.bootstrap()
  await catalog.fetchCourses() // full catalog for search + course labels

  if (facultyId.value) await catalog.fetchDepartments({ facultyId: facultyId.value })
  await refreshDeptCourses()

  prevBaseIds.value = [...baseCourseIds.value]
})

async function save() {
  error.value = ''
  savedOk.value = false

  const n = (fullName.value || '').trim()
  if (!n) return (error.value = 'Full name is required.')
  if (!facultyId.value) return (error.value = 'Choose a faculty to continue.')
  if (!departmentId.value) return (error.value = 'Choose a department to continue.')
  if (!level.value) return (error.value = 'Choose your level to continue.')
  if (baseCourseIds.value.length === 0) return (error.value = 'No default courses found for your department/level yet.')

  busy.value = true
  try {
    await auth.updateProfile({
      fullName: n,
      facultyId: facultyId.value,
      departmentId: departmentId.value,
      level: Number(level.value),
      // Store base + extras (server will also enforce base)
      courseIds: selectedCourseIds.value,
    })
    savedOk.value = true
  } catch (e) {
    error.value = e?.message || 'Failed to save changes.'
  } finally {
    busy.value = false
  }
}

async function logout() {
  await auth.logout()
  router.push('/auth/login')
}
</script>

<template>
  <div class="page">
    <AppCard class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-transparent" />
      <div class="relative">
        <div class="h1">Profile</div>
        <p class="sub mt-1">Update your study profile and account details.</p>

        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="pname">Full name</label>
            <input
              id="pname"
              v-model="fullName"
              class="input"
              autocomplete="name"
              placeholder="Your full name"
            />
            <p class="help">Used for your dashboard greeting.</p>
          </div>

          <div class="flex flex-col sm:items-end sm:justify-end gap-2">
            <AppButton class="w-full sm:w-auto" :disabled="busy" @click="save">
              <span v-if="!busy">Save changes</span>
              <span v-else>Saving…</span>
            </AppButton>
            <button class="btn btn-ghost w-full sm:w-auto" @click="logout">Log out</button>
          </div>
        </div>

        <div v-if="savedOk" class="alert alert-ok mt-4" role="status">Saved successfully.</div>
        <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
      </div>
    </AppCard>

    <AppCard>
      <div class="row">
        <div>
          <div class="h2">Uploads & course reps</div>
          <p class="sub mt-1">Request course-rep access (if you upload content) or manage reps (admin).</p>
        </div>
      </div>

      <div class="divider my-4" />

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="card card-pad border border-border/70 bg-surface/60">
          <div class="text-sm font-semibold">Course rep status</div>
          <p class="sub mt-1">View your request status (pending/approved/denied) and assigned courses.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <RouterLink to="/rep/request" class="btn btn-ghost">Course rep request</RouterLink>
            <RouterLink v-if="role === 'course_rep' || role === 'admin'" to="/uploads" class="btn">Open uploads</RouterLink>
          </div>
        </div>

        <div v-if="role === 'admin'" class="card card-pad border border-border/70 bg-surface/60">
          <div class="text-sm font-semibold">Admin tools</div>
          <p class="sub mt-1">Review requests, manage reps and audit upload changes.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <RouterLink to="/admin/rep-requests" class="btn btn-ghost">Rep requests</RouterLink>
            <RouterLink to="/admin/course-reps" class="btn btn-ghost">Manage reps</RouterLink>
            <RouterLink to="/admin/upload-logs" class="btn btn-ghost">Upload audit log</RouterLink>
            <RouterLink to="/admin/ai-tools" class="btn btn-ghost">AI tools</RouterLink>
          </div>
        </div>

        <div v-else class="card card-pad border border-border/70 bg-surface/60">
          <div class="text-sm font-semibold">Want to help your department?</div>
          <p class="sub mt-1">If you are a class rep or department rep, request course-rep access and upload past questions/materials.</p>
          <div class="mt-3">
            <RouterLink to="/rep/request" class="btn btn-ghost">Request access</RouterLink>
          </div>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <div class="h2">Study settings</div>
      <p class="sub mt-1">These control what content you see by default.</p>

      <div class="divider my-4" />

      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="label" for="pfac">Faculty</label>
          <AppSelect id="pfac" v-model="facultyId" :options="facultyOptions" placeholder="Select faculty…" />
          <p v-if="catalog.loading.faculties" class="help">Loading…</p>
        </div>

        <div>
          <label class="label" for="pdept">Department</label>
          <AppSelect id="pdept" v-model="departmentId" :options="departmentOptions" placeholder="Select department…" />
          <p v-if="catalog.loading.departments" class="help">Loading…</p>
        </div>

        <div>
          <label class="label" for="plevel">Level</label>
          <AppSelect id="plevel" v-model="level" :options="levelOptions" placeholder="Select level…" />
        </div>
      </div>

      <div class="divider my-6" />

      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="h2">Department courses (auto)</div>
          <p class="sub mt-1">Auto-added based on your department and level.</p>
        </div>
        <span class="badge">{{ baseCourseIds.length }}</span>
      </div>

      <div class="mt-3">
        <p v-if="catalog.loading.deptCourses" class="sub">Loading…</p>
        <div v-else-if="!departmentId" class="alert alert-ok" role="status">
          Select a department and level to load your default courses.
        </div>
        <div v-else-if="baseCourses.length === 0" class="alert alert-danger" role="status">
          No courses found for this department/level yet.
        </div>

        <div v-else class="grid gap-2 sm:grid-cols-2">
          <div v-for="c in baseCourses" :key="c.id" class="card card-pad text-left border border-border/70 bg-surface/60">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-semibold">{{ c.code }} — {{ c.title }} ({{ c.level }})</div>
              <span class="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent">Included</span>
            </div>
            <div class="text-xs text-text-3 mt-1">Auto-added (locked)</div>
          </div>
        </div>
      </div>

      <div class="divider my-6" />

      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="h2">Carryovers / extra courses</div>
          <p class="sub mt-1">Add any other courses you want access to.</p>
        </div>
        <span class="badge">{{ selectedExtras.length }}</span>
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

        <div class="mt-4 text-xs text-text-3">
          Total courses: <b>{{ selectedCourseIds.length }}</b> (department + extras)
        </div>
      </div>
    </AppCard>

    <AppCard>
      <div class="h2">Account</div>
      <p class="sub mt-1">Manage your session and app state.</p>

      <div class="divider my-4" />

      <div class="flex flex-col sm:flex-row gap-2">
        <RouterLink to="/dashboard" class="btn btn-ghost">Back to dashboard</RouterLink>
        <RouterLink to="/saved" class="btn btn-ghost">Saved</RouterLink>
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
