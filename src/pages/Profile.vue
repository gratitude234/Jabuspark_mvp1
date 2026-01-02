<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useDataStore } from '../stores/data'
import { apiFetch } from '../utils/api'

import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()
const data = useDataStore()

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

// ---- helper ----
const initials = computed(() => {
  const n = (fullName.value || '').trim()
  if (!n) return 'U'
  const parts = n.split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] || 'U'
  const b = parts[1]?.[0] || ''
  return (a + b).toUpperCase()
})

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// --- Study goal & achievements ---
const dailyGoal = ref(Number(data.progress?.dailyGoal || 10))

watch(
  () => data.progress?.dailyGoal,
  (v) => {
    if (typeof v === 'number' && !Number.isNaN(v)) dailyGoal.value = v
  }
)

const goalBusy = ref(false)

const badgeLabels = {
  first_10: 'First 10 answered',
  first_100: 'First 100 answered',
  first_500: 'First 500 answered',
  streak_7: '7-day streak',
  streak_30: '30-day streak',
  accuracy_80: '80% accuracy',
  goal_complete: 'Goal completed',
  perfect_10: 'Perfect 10',
}

const badges = computed(() => {
  const list = Array.isArray(data.progress?.badges) ? data.progress.badges : []
  return list.map((k) => ({ key: k, label: badgeLabels[k] || String(k).replace(/_/g, ' ') }))
})

const nextLevelIn = computed(() => {
  const xp = Number(data.progress?.xp || 0)
  const levelNow = Number(data.progress?.level || 1)
  const nextAt = levelNow * 250
  return Math.max(0, nextAt - xp)
})

const progressTodayAnswered = computed(() => Number(data.progress?.todayAnswered || 0))
const progressDailyGoal = computed(() => Number(data.progress?.dailyGoal || dailyGoal.value || 1))
const progressPct = computed(() => {
  const denom = progressDailyGoal.value || 1
  return Math.min(100, Math.round((progressTodayAnswered.value / denom) * 100))
})

async function saveDailyGoal() {
  goalBusy.value = true
  try {
    await data.setDailyGoal(dailyGoal.value)
  } finally {
    goalBusy.value = false
  }
}

// --- Study settings ---
const levelOptions = [
  { value: 100, label: '100 Level' },
  { value: 200, label: '200 Level' },
  { value: 300, label: '300 Level' },
  { value: 400, label: '400 Level' },
  { value: 500, label: '500 Level' },
  { value: 600, label: '600 Level' },
]

const facultyOptions = computed(() => (catalog.faculties || []).map((f) => ({ value: f.id, label: f.name })))
const departmentOptions = computed(() => (catalog.departments || []).map((d) => ({ value: d.id, label: d.name })))

const displayFaculty = computed(() => {
  const v = facultyId.value
  if (!v) return '—'
  return facultyOptions.value.find((x) => String(x.value) === String(v))?.label || '—'
})
const displayDepartment = computed(() => {
  const v = departmentId.value
  if (!v) return '—'
  return departmentOptions.value.find((x) => String(x.value) === String(v))?.label || '—'
})
const displayLevel = computed(() => (level.value ? `${level.value} Level` : '—'))

const baseCourses = computed(() => catalog.deptCourses || [])
const baseCourseIds = computed(() => baseCourses.value.map((c) => c.id))

// Track previous base ids so we can preserve extras if department/level changes
const prevBaseIds = ref([])

const selectedCourseIds = computed(() => {
  const set = new Set([...baseCourseIds.value, ...pickedCourseIds.value])
  return [...set]
})

const selectedExtras = computed(() => {
  const base = new Set(baseCourseIds.value)
  const byId = new Map((catalog.courses || []).map((c) => [c.id, c]))
  const extras = pickedCourseIds.value.filter((id) => !base.has(id))
  return extras.map((id) => byId.get(id)).filter(Boolean)
})

const extraOptions = computed(() => {
  const q = courseQuery.value.trim().toLowerCase()
  const base = new Set(baseCourseIds.value)
  const selected = new Set(selectedCourseIds.value)

  let list = (catalog.courses || []).filter((c) => !base.has(c.id) && !selected.has(c.id))
  if (!q) return list.slice(0, 12)

  list = list.filter((c) => (`${c.code} ${c.title}`.toLowerCase().includes(q)))
  return list.slice(0, 12)
})

function addExtraCourse(id) {
  if (!id) return
  if (pickedCourseIds.value.includes(id)) return
  pickedCourseIds.value.push(id)
}

function removeExtraCourse(id) {
  pickedCourseIds.value = pickedCourseIds.value.filter((x) => x !== id)
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
  const oldExtras = pickedCourseIds.value.filter((id) => !oldBase.has(id))

  await refreshDeptCourses()

  // Ensure base courses are always included, preserve extras
  const set = new Set([...baseCourseIds.value, ...oldExtras])
  pickedCourseIds.value = [...set]
  prevBaseIds.value = [...baseCourseIds.value]
})

// --- UX: dirty-state + clarity about what "Save" does ---
function asStrList(arr) {
  return (Array.isArray(arr) ? arr : []).map((x) => String(x)).sort()
}
function sameList(a, b) {
  const A = asStrList(a)
  const B = asStrList(b)
  if (A.length !== B.length) return false
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false
  return true
}

const isNameDirty = computed(() => (fullName.value || '') !== (user.value?.fullName || ''))
const isStudySettingsDirty = computed(() => {
  const p = profile.value || {}
  return (
    (facultyId.value || null) !== (p.facultyId || null) ||
    (departmentId.value || null) !== (p.departmentId || null) ||
    Number(level.value || 0) !== Number(p.level || 0)
  )
})
const isCoursesDirty = computed(() => {
  const p = profile.value || {}
  return !sameList(selectedCourseIds.value, p.courseIds || [])
})

const dirtySections = computed(() => {
  const s = []
  if (isNameDirty.value) s.push('Name')
  if (isStudySettingsDirty.value) s.push('Study settings')
  if (isCoursesDirty.value) s.push('Courses')
  return s
})

const isDirty = computed(() => dirtySections.value.length > 0)
const saveCtaLabel = computed(() => 'Save changes')

// --- Save profile (also saves study settings + courses) ---
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
      courseIds: selectedCourseIds.value,
    })
    savedOk.value = true
    await fetchRepStatus()
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

async function resetToSaved() {
  const u = user.value || {}
  const p = profile.value || {}

  fullName.value = u.fullName || ''
  facultyId.value = p.facultyId || null
  departmentId.value = p.departmentId || null
  level.value = p.level || 200
  pickedCourseIds.value = [...(p.courseIds || [])]
  courseQuery.value = ''
  savedOk.value = false
  error.value = ''

  if (facultyId.value) await catalog.fetchDepartments({ facultyId: facultyId.value })
  await refreshDeptCourses()
  prevBaseIds.value = [...baseCourseIds.value]
}

// --- Upload / course rep workflow ---
const hasStudySetup = computed(() => {
  const n = (fullName.value || '').trim()
  return !!n && !!facultyId.value && !!departmentId.value && !!level.value
})

const isProfileDirty = computed(() => {
  const u = user.value || {}
  const p = profile.value || {}
  return (
    (fullName.value || '') !== (u.fullName || '') ||
    (facultyId.value || null) !== (p.facultyId || null) ||
    (departmentId.value || null) !== (p.departmentId || null) ||
    Number(level.value || 0) !== Number(p.level || 0)
  )
})

const uploadsDisabled = computed(() => {
  const u = user.value || {}
  const p = profile.value || {}
  return Boolean(u.uploadsDisabled ?? u.uploads_disabled ?? p.uploadsDisabled ?? p.uploads_disabled ?? false)
})

const repCourseIds = computed(() => {
  const u = user.value || {}
  const p = profile.value || {}
  const ids = p.repCourseIds || p.rep_course_ids || u.repCourseIds || u.rep_course_ids || []
  return Array.isArray(ids) ? ids.map((x) => String(x)) : []
})

const coursesById = computed(() => {
  const m = new Map()
  for (const c of catalog.courses || []) m.set(String(c.id), c)
  return m
})

const repCoursesLabel = computed(() => {
  const ids = repCourseIds.value
  if (!ids.length) return []
  return ids
    .map((id) => coursesById.value.get(String(id)))
    .filter(Boolean)
    .map((c) => `${c.code}`)
})

const repBusy = ref(false)
const repError = ref('')
const repInfo = ref(null)

function normalizeRepInfo(res) {
  const r = res?.data ?? res
  if (!r || typeof r !== 'object') return null
  return r
}

async function fetchRepStatus() {
  repError.value = ''
  repBusy.value = true
  try {
    const res = await apiFetch('/rep/my', { method: 'GET' })
    repInfo.value = normalizeRepInfo(res)
  } catch (e) {
    repInfo.value = null
    repError.value = ''
  } finally {
    repBusy.value = false
  }
}

const repState = computed(() => {
  if (role.value === 'admin') return 'admin'
  if (role.value === 'course_rep') return 'approved'

  const s1 = repInfo.value?.status || repInfo.value?.state
  if (s1) {
    const s = String(s1).toLowerCase()
    if (s === 'rejected' || s === 'denied') return 'denied'
    if (s === 'approved') return 'approved'
    if (s === 'pending') return 'pending'
  }

  const p = profile.value || {}
  const raw = p.repStatus || p.rep_status || null
  if (!raw) return 'none'
  const s = String(raw).toLowerCase()
  if (s === 'rejected') return 'denied'
  return s
})

const repStateLabel = computed(() => {
  switch (repState.value) {
    case 'approved':
      return 'Approved'
    case 'pending':
      return 'Pending'
    case 'denied':
      return 'Denied'
    case 'admin':
      return 'Admin'
    default:
      return 'Not requested'
  }
})

const repHint = computed(() => {
  if (uploadsDisabled.value && (role.value === 'course_rep' || role.value === 'admin')) {
    return 'Uploads are currently disabled for your account. Contact an admin.'
  }
  if (repState.value === 'pending') return 'Your request is under review.'
  if (repState.value === 'denied')
    return repInfo.value?.reason || repInfo.value?.message || 'Your request was denied. You can update and resubmit.'
  if (repState.value === 'approved') return 'You can upload for your assigned courses.'
  return 'Apply to become a course rep to upload past questions and materials.'
})

async function goRepRequest() {
  error.value = ''

  if (!hasStudySetup.value) {
    error.value = 'Set your Full name, Faculty, Department and Level first (then save) before requesting upload access.'
    scrollToId('study-settings')
    return
  }

  if (baseCourseIds.value.length === 0) {
    error.value = 'No department courses found for your selected department/level yet. Change department/level or contact admin.'
    scrollToId('study-settings')
    return
  }

  if (isProfileDirty.value) {
    await save()
    if (error.value) return
  }

  if (role.value === 'course_rep') {
    router.push({ path: '/rep/request', query: { mode: 'more' } })
  } else {
    router.push('/rep/request')
  }
}

function goUploads() {
  error.value = ''
  if (uploadsDisabled.value) {
    error.value = 'Uploads are disabled for your account. Contact an admin.'
    return
  }
  router.push('/uploads')
}

const showAllBase = ref(false)
const baseVisible = computed(() => {
  const list = baseCourses.value || []
  if (showAllBase.value) return list
  return list.slice(0, 6)
})

onMounted(async () => {
  await catalog.bootstrap()
  await catalog.fetchCourses()
  await data.fetchProgress()

  if (facultyId.value) await catalog.fetchDepartments({ facultyId: facultyId.value })
  await refreshDeptCourses()
  prevBaseIds.value = [...baseCourseIds.value]

  await fetchRepStatus()
})
</script>

<template>
  <div class="page">
    <!-- Sticky Save Bar (only when dirty) -->
    <div v-if="isDirty" class="fixed inset-x-0 bottom-3 z-40 px-3">
      <div class="container-app">
        <div class="card p-3 sm:p-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold">Unsaved changes</div>
              <div class="text-xs text-text-3 mt-1">
                Updated: <b>{{ dirtySections.join(', ') }}</b>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-2">
              <AppButton class="btn-primary" :disabled="busy" @click="save">
                <span v-if="busy">Saving…</span>
                <span v-else>{{ saveCtaLabel }}</span>
              </AppButton>
              <button class="btn btn-ghost" type="button" :disabled="busy" @click="resetToSaved">Discard</button>
              <button class="btn btn-ghost" type="button" @click="scrollToId('profile-top')">Top</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Layout: main + sidebar (desktop), stacked (mobile) -->
    <div class="container-app grid gap-4 lg:grid-cols-12">
      <!-- MAIN -->
      <div class="lg:col-span-8 space-y-4">
        <!-- HEADER -->
        <AppCard id="profile-top">
          <div class="row">
            <div>
              <div class="kicker">Account</div>
              <div class="h1 mt-1">Profile</div>
              <p class="sub mt-2 max-w-[70ch]">
                Update your name and study settings. Upload access is tied to your department setup.
              </p>
            </div>

            <div class="flex flex-col items-stretch sm:items-end gap-2">
              <div class="flex items-center justify-end gap-2">
                <span class="badge" v-if="!isDirty">All changes saved</span>
                <span class="badge" v-else>Not saved</span>
                <span class="badge">{{ role }}</span>
              </div>

              <div class="flex gap-2 justify-end">
                <button class="btn btn-ghost" type="button" @click="logout">Log out</button>
                <AppButton class="btn-primary" :disabled="busy || !isDirty" @click="save">
                  <span v-if="busy">Saving…</span>
                  <span v-else>Save</span>
                </AppButton>
              </div>
            </div>
          </div>

          <div v-if="savedOk" class="alert alert-ok mt-4" role="status">Saved successfully.</div>
          <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>

          <div class="divider my-5" />

          <!-- Identity row -->
          <div class="grid gap-4 sm:grid-cols-[auto,1fr] items-start">
            <div class="tile flex items-center justify-center w-16 h-16 rounded-full text-lg font-bold">
              {{ initials }}
            </div>

            <div class="space-y-3">
              <div>
                <label class="label" for="pname">Full name</label>
                <input id="pname" v-model="fullName" class="input" autocomplete="name" placeholder="Your full name" />
                <p class="help">Used across your dashboard and uploads requests.</p>
              </div>

              <div class="grid gap-3 sm:grid-cols-3">
                <div class="tile">
                  <div class="text-xs text-text-3">Faculty</div>
                  <div class="mt-1 font-semibold truncate">{{ displayFaculty }}</div>
                </div>
                <div class="tile">
                  <div class="text-xs text-text-3">Department</div>
                  <div class="mt-1 font-semibold truncate">{{ displayDepartment }}</div>
                </div>
                <div class="tile">
                  <div class="text-xs text-text-3">Level</div>
                  <div class="mt-1 font-semibold truncate">{{ displayLevel }}</div>
                </div>
              </div>
            </div>
          </div>
        </AppCard>

        <!-- GOAL + BADGES (compact row) -->
        <AppCard id="study-goal">
          <div class="row">
            <div>
              <div class="h2">Study goal</div>
              <p class="sub mt-1">Set a daily target and track your progress.</p>
            </div>
            <button class="btn btn-ghost" type="button" @click="scrollToId('study-settings')">Edit study settings</button>
          </div>

          <div class="divider my-4" />

          <div class="grid gap-3 md:grid-cols-3">
            <div class="tile">
              <div class="text-sm font-semibold">Daily goal</div>
              <p class="help mt-1">Questions to answer today.</p>

              <div class="mt-3 flex items-center gap-2">
                <input v-model.number="dailyGoal" type="number" min="5" max="200" class="input w-28" :disabled="goalBusy" />
                <AppButton size="sm" :disabled="goalBusy" @click="saveDailyGoal">
                  <span v-if="goalBusy">Saving…</span>
                  <span v-else>Save</span>
                </AppButton>
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(10)">10</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(20)">20</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(50)">50</button>
              </div>

              <div class="mt-3 text-xs text-text-3">
                Today: <b>{{ progressTodayAnswered }}</b> / {{ progressDailyGoal }}
              </div>
              <div class="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div class="h-full bg-accent" :style="{ width: progressPct + '%' }" />
              </div>
            </div>

            <div class="tile">
              <div class="text-sm font-semibold">Level</div>
              <div class="mt-2 text-2xl font-extrabold">Level {{ data.progress?.level || 1 }}</div>
              <div class="mt-2 text-sm text-text-2">{{ data.progress?.xp || 0 }} XP</div>
              <div class="mt-1 text-xs text-text-3">Next level in {{ nextLevelIn }} XP</div>
            </div>

            <div class="tile">
              <div class="text-sm font-semibold">Badges</div>
              <p class="help mt-1">Consistency wins.</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span v-if="!badges.length" class="text-xs text-text-3">No badges yet — start practising!</span>
                <span v-for="b in badges" :key="b.key" class="badge">{{ b.label }}</span>
              </div>
            </div>
          </div>
        </AppCard>

        <!-- STUDY SETTINGS (tight + cleaner) -->
        <AppCard id="study-settings">
          <div class="row">
            <div>
              <div class="h2">Study settings</div>
              <p class="sub mt-1">This controls what content you see by default.</p>
              <p class="help mt-2">Auto courses are locked; extras are optional.</p>
            </div>

            <div class="flex gap-2">
              <AppButton class="btn-primary" :disabled="busy || !isDirty" @click="save">
                <span v-if="busy">Saving…</span>
                <span v-else>Save</span>
              </AppButton>
              <button class="btn btn-ghost" type="button" @click="scrollToId('profile-top')">Back</button>
            </div>
          </div>

          <div class="divider my-4" />

          <div class="grid gap-4 md:grid-cols-3">
            <div>
              <label class="label" for="pfac">Faculty</label>
              <AppSelect id="pfac" v-model="facultyId" :options="facultyOptions" placeholder="Select faculty…" />
            </div>
            <div>
              <label class="label" for="pdept">Department</label>
              <AppSelect id="pdept" v-model="departmentId" :options="departmentOptions" placeholder="Select department…" />
            </div>
            <div>
              <label class="label" for="plevel">Level</label>
              <AppSelect id="plevel" v-model="level" :options="levelOptions" placeholder="Select level…" />
            </div>
          </div>

          <div class="divider my-6" />

          <div class="grid gap-4 lg:grid-cols-2">
            <!-- Auto courses -->
            <div>
              <div class="row">
                <div>
                  <div class="h2">Department courses</div>
                  <p class="sub mt-1">Auto-added and locked.</p>
                </div>
                <span class="badge">{{ baseCourseIds.length }}</span>
              </div>

              <div class="mt-3">
                <div v-if="!departmentId" class="alert alert-ok">Select department + level to load courses.</div>
                <div v-else-if="baseCourses.length === 0" class="alert alert-danger">No courses found for this department/level yet.</div>

                <div v-else class="grid gap-2 sm:grid-cols-2">
                  <div v-for="c in baseVisible" :key="c.id" class="tile">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="text-sm font-semibold truncate">{{ c.code }}</div>
                        <div class="text-xs text-text-3 truncate">{{ c.title }}</div>
                      </div>
                      <span class="badge">Included</span>
                    </div>
                  </div>
                </div>

                <div v-if="baseCourses.length > 6" class="mt-3">
                  <button type="button" class="btn btn-ghost" @click="showAllBase = !showAllBase">
                    <span v-if="showAllBase">Show less</span>
                    <span v-else>Show all ({{ baseCourses.length }})</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Extra courses -->
            <div>
              <div class="row">
                <div>
                  <div class="h2">Carryovers / extras</div>
                  <p class="sub mt-1">Add more courses you want access to.</p>
                </div>
                <span class="badge">{{ selectedExtras.length }}</span>
              </div>

              <div class="mt-3">
                <input v-model="courseQuery" class="input w-full" type="text" placeholder="Search course code or title…" :disabled="busy" />

                <div v-if="selectedExtras.length" class="mt-3">
                  <div class="text-xs text-text-3 mb-2">Selected (tap to remove)</div>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="c in selectedExtras"
                      :key="c.id"
                      type="button"
                      class="chip"
                      @click="removeExtraCourse(c.id)"
                      :disabled="busy"
                    >
                      {{ c.code }} <span class="opacity-70">×</span>
                    </button>
                  </div>
                </div>

                <div class="mt-4">
                  <div v-if="extraOptions.length === 0" class="help">
                    {{ courseQuery ? 'No courses match your search.' : 'Search to add carryover courses.' }}
                  </div>

                  <div v-else class="grid gap-2 sm:grid-cols-2 mt-2">
                    <button
                      v-for="c in extraOptions"
                      :key="c.id"
                      type="button"
                      class="tile text-left"
                      :disabled="busy"
                      @click="addExtraCourse(c.id)"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <div class="text-sm font-semibold truncate">{{ c.code }}</div>
                          <div class="text-xs text-text-3 truncate">{{ c.title }}</div>
                        </div>
                        <span class="badge">+</span>
                      </div>
                      <div class="text-xs text-text-3 mt-2">Tap to add</div>
                    </button>
                  </div>
                </div>

                <div class="mt-4 text-xs text-text-3">
                  Total courses: <b>{{ selectedCourseIds.length }}</b>
                </div>
              </div>
            </div>
          </div>
        </AppCard>

        <!-- ACCOUNT -->
        <AppCard id="account">
          <div class="row">
            <div>
              <div class="h2">Account</div>
              <p class="sub mt-1">Quick links.</p>
            </div>
            <button class="btn btn-ghost" type="button" @click="scrollToId('profile-top')">Back to top</button>
          </div>

          <div class="divider my-4" />

          <div class="flex flex-wrap gap-2">
            <RouterLink to="/dashboard" class="btn btn-ghost">Dashboard</RouterLink>
            <RouterLink to="/saved" class="btn btn-ghost">Saved</RouterLink>
          </div>
        </AppCard>
      </div>

      <!-- SIDEBAR -->
      <div class="lg:col-span-4 space-y-4">
        <!-- Overview / Actions -->
        <AppCard>
          <div class="h2">Quick actions</div>
          <p class="sub mt-1">Your uploader status and shortcuts.</p>

          <div class="divider my-4" />

          <div class="tile">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs text-text-3">Uploader access</div>
                <div class="mt-1 font-semibold">{{ repStateLabel }}</div>
                <div class="mt-1 text-xs text-text-3 truncate">{{ repHint }}</div>
              </div>
              <span class="badge">{{ role === 'admin' ? 'Admin' : repStateLabel }}</span>
            </div>

            <div v-if="repState === 'approved' && repCourseIds.length" class="mt-3">
              <div class="text-xs text-text-3 mb-2">Assigned courses</div>
              <div class="flex flex-wrap gap-2">
                <span v-for="(c, i) in repCoursesLabel.slice(0, 10)" :key="c + i" class="chip">{{ c }}</span>
                <span v-if="repCoursesLabel.length > 10" class="chip">+{{ repCoursesLabel.length - 10 }} more</span>
              </div>
            </div>
          </div>

          <div class="mt-3 flex flex-col gap-2">
            <button class="btn btn-ghost" type="button" :disabled="repBusy" @click="fetchRepStatus">
              <span v-if="repBusy">Refreshing…</span>
              <span v-else>Refresh status</span>
            </button>

            <AppButton
              v-if="role === 'course_rep' || role === 'admin'"
              class="btn-primary"
              :disabled="uploadsDisabled"
              @click="goUploads"
            >
              Open uploads
            </AppButton>

            <button
              v-else
              class="btn btn-ghost"
              type="button"
              :disabled="repState === 'pending'"
              @click="goRepRequest"
            >
              <span v-if="repState === 'pending'">Request pending</span>
              <span v-else-if="repState === 'denied'">Edit & resubmit request</span>
              <span v-else>Apply for upload access</span>
            </button>

            <button class="btn btn-ghost" type="button" @click="scrollToId('study-settings')">Study settings</button>
          </div>

          <div v-if="repError" class="alert alert-danger mt-3">{{ repError }}</div>
        </AppCard>

        <!-- Mini nav -->
        <AppCard>
          <div class="h2">Jump to</div>
          <div class="divider my-4" />
          <div class="flex flex-wrap gap-2">
            <button class="chip" type="button" @click="scrollToId('profile-top')">Profile</button>
            <button class="chip" type="button" @click="scrollToId('study-goal')">Goal</button>
            <button class="chip" type="button" @click="scrollToId('study-settings')">Settings</button>
            <button class="chip" type="button" @click="scrollToId('account')">Account</button>
          </div>
        </AppCard>
      </div>
    </div>
  </div>
</template>
