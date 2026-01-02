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

// --- Study goal & achievements ---
const dailyGoal = ref(Number(data.progress?.dailyGoal || 10))

watch(
  () => data.progress?.dailyGoal,
  (v) => {
    if (typeof v === 'number' && !Number.isNaN(v)) dailyGoal.value = v
  }
)

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

async function saveDailyGoal() {
  await data.setDailyGoal(dailyGoal.value)
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

// --- UX: dirty-state + clarity about what "Save" does ---
function asStrList(arr) {
  return (Array.isArray(arr) ? arr : []).map(x => String(x)).sort()
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

const saveCtaLabel = computed(() => {
  // clearer CTA (the whole goal of this change)
  return 'Save profile & study settings'
})

function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  // best-effort refresh for consistency after reset
  if (facultyId.value) await catalog.fetchDepartments({ facultyId: facultyId.value })
  await refreshDeptCourses()
  prevBaseIds.value = [...baseCourseIds.value]
}

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
      // Store base + extras (server will also enforce base)
      courseIds: selectedCourseIds.value,
    })
    savedOk.value = true

    // After saving, refresh rep status so request scope is consistent
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

// --- Upload / course rep workflow (perfected) ---
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
  return Boolean(
    u.uploadsDisabled ??
    u.uploads_disabled ??
    p.uploadsDisabled ??
    p.uploads_disabled ??
    false
  )
})

const repCourseIds = computed(() => {
  const u = user.value || {}
  const p = profile.value || {}
  const ids =
    p.repCourseIds ||
    p.rep_course_ids ||
    u.repCourseIds ||
    u.rep_course_ids ||
    []
  return Array.isArray(ids) ? ids.map(x => String(x)) : []
})

const coursesById = computed(() => {
  const m = new Map()
  for (const c of (catalog.courses || [])) m.set(String(c.id), c)
  return m
})

const repCoursesLabel = computed(() => {
  const ids = repCourseIds.value
  if (!ids.length) return []
  return ids
    .map(id => coursesById.value.get(String(id)))
    .filter(Boolean)
    .map(c => `${c.code}`)
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
    case 'approved': return 'Approved'
    case 'pending': return 'Pending'
    case 'denied': return 'Denied'
    case 'admin': return 'Admin'
    default: return 'Not requested'
  }
})

const repHint = computed(() => {
  if (uploadsDisabled.value && (role.value === 'course_rep' || role.value === 'admin')) {
    return 'Uploads are currently disabled for your account. Contact an admin.'
  }
  if (repState.value === 'pending') return 'Your request is under review.'
  if (repState.value === 'denied') return repInfo.value?.reason || repInfo.value?.message || 'Your request was denied. You can update and resubmit.'
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

// --- Lifecycle ---
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
    <!-- Sticky save bar (shows when user edits Study settings / Name / Courses) -->
    <div v-if="isDirty" class="fixed inset-x-0 bottom-3 z-40 px-3">
      <div class="container-app">
        <div class="card card-pad border border-border/70 bg-surface/80 backdrop-blur">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold">Unsaved changes</div>
              <div class="text-xs text-text-3 mt-1">
                You changed: <b>{{ dirtySections.join(', ') }}</b>. These will reset after reload unless you save.
              </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
              <AppButton :disabled="busy" class="btn-primary" @click="save">
                <span v-if="!busy">{{ saveCtaLabel }}</span>
                <span v-else>Saving…</span>
              </AppButton>
              <button class="btn btn-ghost" :disabled="busy" @click="resetToSaved">Discard</button>
              <button class="btn btn-ghost" type="button" @click="scrollToId('profile-top')">Go to top</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Header -->
    <AppCard id="profile-top" class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-transparent" />
      <div class="relative">
        <div class="h1">Profile</div>
        <p class="sub mt-1">Update your name, study settings and course selections.</p>

        <!-- Clarity chips: what this save button includes -->
        <div class="mt-3 flex flex-wrap gap-2">
          <span class="chip">Saves: Name</span>
          <span class="chip">Faculty / Department / Level</span>
          <span class="chip">Courses (auto + extras)</span>
        </div>

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
            <p class="help">Used for your dashboard greeting and account display.</p>
          </div>

          <div class="flex flex-col sm:items-end sm:justify-end gap-2">
            <AppButton class="w-full sm:w-auto btn-primary" :disabled="busy" @click="save">
              <span v-if="!busy">{{ saveCtaLabel }}</span>
              <span v-else>Saving…</span>
            </AppButton>
            <button class="btn btn-ghost w-full sm:w-auto" @click="logout">Log out</button>
          </div>
        </div>

        <div v-if="savedOk" class="alert alert-ok mt-4" role="status">
          Saved successfully. Your study settings will stay after reload.
        </div>
        <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
      </div>
    </AppCard>

    <!-- Study goal -->
    <AppCard>
      <div class="h2">Study goal & achievements</div>
      <p class="sub mt-1">Set a daily question goal and track your level and badges.</p>

      <div class="divider my-4" />

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card card-pad border border-border/70 bg-surface/60">
          <div class="text-sm font-semibold">Daily goal</div>
          <p class="sub mt-1">How many questions you want to answer today.</p>

          <div class="mt-3 flex items-center gap-2">
            <input
              v-model.number="dailyGoal"
              type="number"
              min="5"
              max="200"
              class="input"
              style="max-width: 130px"
            />
            <AppButton size="sm" @click="saveDailyGoal">Save</AppButton>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(10)">10</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(20)">20</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(50)">50</button>
          </div>

          <div class="mt-4 text-xs text-text-3">
            Today: <b>{{ data.progress.todayAnswered }}</b> / {{ data.progress.dailyGoal }}
          </div>
          <div class="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              class="h-full bg-accent transition-all duration-200"
              :style="{ width: Math.min(100, Math.round((data.progress.todayAnswered / (data.progress.dailyGoal || 1)) * 100)) + '%' }"
            />
          </div>
        </div>

        <div class="card card-pad border border-border/70 bg-surface/60">
          <div class="text-sm font-semibold">Level</div>
          <div class="mt-1 text-2xl font-extrabold">Level {{ data.progress.level }}</div>
          <div class="mt-2 text-sm text-text-2">{{ data.progress.xp }} XP</div>
          <div class="mt-2 text-xs text-text-3">Next level in {{ nextLevelIn }} XP</div>
        </div>

        <div class="card card-pad border border-border/70 bg-surface/60">
          <div class="text-sm font-semibold">Badges</div>
          <p class="sub mt-1">Small wins that keep you consistent.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span v-if="!badges.length" class="text-xs text-text-3">No badges yet — start practising!</span>
            <span
              v-for="b in badges"
              :key="b.key"
              class="badge"
              :title="b.key"
            >{{ b.label }}</span>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- Uploads & reps -->
    <AppCard id="uploads-reps">
      <div class="row">
        <div>
          <div class="h2">Uploads & course reps</div>
          <p class="sub mt-1">One flow: set department → save → request access → get approved → upload.</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost" :disabled="repBusy" @click="fetchRepStatus">
            <span v-if="!repBusy">Refresh status</span>
            <span v-else>Refreshing…</span>
          </button>
        </div>
      </div>

      <div class="divider my-4" />

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="card card-pad border border-border/70 bg-surface/60">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold">Uploader access</div>
              <p class="sub mt-1">{{ repHint }}</p>

              <div v-if="repState === 'approved' && repCourseIds.length" class="mt-3">
                <div class="text-xs text-text-3 mb-2">Assigned courses</div>
                <div class="flex flex-wrap gap-2">
                  <span v-for="(c, i) in repCoursesLabel.slice(0, 10)" :key="c + i" class="chip">{{ c }}</span>
                  <span v-if="repCoursesLabel.length > 10" class="chip">+{{ repCoursesLabel.length - 10 }} more</span>
                </div>
              </div>
            </div>

            <span class="badge" :title="repState">{{ repStateLabel }}</span>
          </div>

          <div v-if="role !== 'course_rep' && role !== 'admin' && !hasStudySetup" class="alert alert-danger mt-3" role="status">
            Set your Full name, Faculty, Department and Level (then save) before requesting upload access.
          </div>

          <div v-else-if="isDirty" class="alert alert-ok mt-3" role="status">
            You have unsaved changes — click <b>{{ saveCtaLabel }}</b> so your request uses the correct department/level.
          </div>

          <div v-else-if="baseCourseIds.length === 0 && departmentId" class="alert alert-danger mt-3" role="status">
            No department courses found for this department/level yet.
          </div>

          <div v-if="uploadsDisabled && (role === 'course_rep' || role === 'admin')" class="alert alert-danger mt-3" role="status">
            Uploads are disabled for your account.
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <AppButton
              v-if="role === 'course_rep' || role === 'admin'"
              class="btn-primary"
              :disabled="uploadsDisabled"
              @click="goUploads"
            >
              Open uploads
            </AppButton>

            <button v-else-if="repState === 'pending'" type="button" class="btn btn-ghost" disabled>
              Request pending
            </button>

            <button v-else-if="role !== 'admin'" type="button" class="btn btn-ghost" @click="goRepRequest">
              <span v-if="repState === 'denied'">Edit & resubmit request</span>
              <span v-else>Apply for upload access</span>
            </button>

            <button v-if="role === 'course_rep'" type="button" class="btn btn-ghost" @click="goRepRequest">
              Request more access
            </button>

            <button type="button" class="btn btn-ghost" @click="scrollToId('study-settings')">
              Study settings
            </button>
          </div>

          <div class="mt-4 text-xs text-text-3">
            <div class="font-semibold text-text-2 mb-1">How it works</div>
            <ul class="list-disc pl-4 space-y-1">
              <li>Pick your department & level.</li>
              <li>Click <b>{{ saveCtaLabel }}</b>.</li>
              <li>Request uploader access and wait for approval.</li>
            </ul>
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
          <div class="text-sm font-semibold">Upload quality tips</div>
          <p class="sub mt-1">
            Always pick the correct course, session and semester. Wrong tagging leads to rejection.
          </p>
          <div class="mt-3 text-xs text-text-3">
            If you’re a department rep, request access for department scope — not just one course.
          </div>
        </div>
      </div>
    </AppCard>

    <!-- Study settings -->
    <AppCard id="study-settings">
      <div class="row">
        <div>
          <div class="h2">Study settings</div>
          <p class="sub mt-1">These control what content you see by default.</p>
          <p class="help mt-2">
            Important: changes here only persist after you click <b>{{ saveCtaLabel }}</b>.
          </p>
        </div>

        <!-- Section save CTA (same global save) -->
        <div class="flex flex-col sm:flex-row gap-2 sm:items-start">
          <AppButton class="w-full sm:w-auto btn-primary" :disabled="busy" @click="save">
            <span v-if="!busy">Save study settings</span>
            <span v-else>Saving…</span>
          </AppButton>
          <button class="btn btn-ghost w-full sm:w-auto" type="button" @click="scrollToId('profile-top')">
            View full profile save
          </button>
        </div>
      </div>

      <div v-if="isStudySettingsDirty || isCoursesDirty" class="alert alert-ok mt-4" role="status">
        You have unsaved changes in <b>{{ [isStudySettingsDirty ? 'Study settings' : null, isCoursesDirty ? 'Courses' : null].filter(Boolean).join(' & ') }}</b>.
        Click <b>{{ saveCtaLabel }}</b> to keep them after reload.
      </div>

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
          No courses found for this department/level yet. You can’t save these settings until default courses exist.
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
            class="chip"
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

        <!-- Another save reminder at the bottom (when deep scrolling) -->
        <div v-if="isDirty" class="alert alert-ok mt-4" role="status">
          Tip: Click <b>{{ saveCtaLabel }}</b> (top or sticky bar) to keep these changes after reload.
        </div>
      </div>
    </AppCard>

    <!-- Account -->
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
