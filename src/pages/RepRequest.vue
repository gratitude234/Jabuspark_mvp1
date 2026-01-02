<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { apiFetch } from '../utils/api'

import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const catalog = useCatalogStore()

const user = computed(() => auth.user || {})
const profile = computed(() => user.value.profile || {})
const role = computed(() => user.value.role || 'student')

// ✅ “Request more access” mode (for already-approved course reps)
const isMoreMode = computed(() => String(route.query?.mode || '').toLowerCase() === 'more')
const isApprovedRole = computed(() => auth.user?.role === 'course_rep' || auth.user?.role === 'admin')
const pageTitle = computed(() => (isMoreMode.value ? 'Request more access' : 'Course Rep Access'))
const pageSub = computed(() => {
  if (isMoreMode.value) {
    return 'Request additional upload access for more courses. An admin must approve it.'
  }
  return 'Request upload permission for your department courses. An admin must approve you.'
})

const request = ref(null)
const loading = ref(false)
const error = ref('')
const ok = ref('')

// Form
const level = ref(Number(profile.value.level || 200))
const reason = ref('')
const proofUrl = ref('')

// Course selection UX
const mode = ref('dept') // 'dept' | 'custom'
const courseQuery = ref('')
const selectedCourseIds = ref([])

// Derived profile fields
const fullName = computed(() => (user.value.fullName || '').trim())
const facultyId = computed(() => profile.value.facultyId || null)
const departmentId = computed(() => profile.value.departmentId || null)
const hasStudySetup = computed(() => !!fullName.value && !!facultyId.value && !!departmentId.value && !!level.value)

// Dept courses (source of truth for “department scope” requests)
const deptCourses = computed(() => catalog.deptCourses || [])
const deptCourseIds = computed(() => deptCourses.value.map(c => c.id))

const levelOptions = [
  { value: 100, label: '100 Level' },
  { value: 200, label: '200 Level' },
  { value: 300, label: '300 Level' },
  { value: 400, label: '400 Level' },
  { value: 500, label: '500 Level' },
  { value: 600, label: '600 Level' },
]

// Map for course labels
const byId = computed(() => new Map((catalog.courses || []).map(c => [String(c.id), c])))

const selectedCourses = computed(() => {
  return selectedCourseIds.value
    .map(id => byId.value.get(String(id)))
    .filter(Boolean)
})

const requestStatus = computed(() => {
  const st = request.value?.status || request.value?.state || ''
  return String(st || '').toLowerCase()
})

const statusBadgeClass = computed(() => {
  const st = requestStatus.value
  if (st === 'approved') return 'badge bg-accent/15 border border-accent/30 text-text'
  if (st === 'denied' || st === 'rejected') return 'badge bg-red-500/10 border border-red-500/25 text-red-200'
  if (st === 'pending') return 'badge bg-white/5 border border-border/60 text-text'
  return 'badge'
})

const canSubmit = computed(() => {
  if (!hasStudySetup.value) return false
  if (deptCourseIds.value.length === 0) return false
  if (loading.value) return false
  if (requestStatus.value === 'pending') return false
  if (!reason.value.trim()) return false
  if (selectedCourseIds.value.length < 1) return false
  return true
})

function formatDate(x) {
  if (!x) return ''
  try {
    const d = new Date(x)
    if (Number.isNaN(d.getTime())) return String(x)
    return d.toLocaleString()
  } catch {
    return String(x)
  }
}

function ensureDeptDefaultsSelected() {
  // In dept mode, always select dept courses as baseline.
  if (mode.value !== 'dept') return
  const set = new Set(selectedCourseIds.value.map(String))
  for (const id of deptCourseIds.value) set.add(String(id))
  selectedCourseIds.value = [...set]
}

function toggleCourse(id) {
  const sid = String(id)
  const i = selectedCourseIds.value.map(String).indexOf(sid)
  if (i >= 0) selectedCourseIds.value.splice(i, 1)
  else selectedCourseIds.value.push(id)
}

function removeSelected(id) {
  const sid = String(id)
  selectedCourseIds.value = selectedCourseIds.value.filter(x => String(x) !== sid)
}

const customCourseOptions = computed(() => {
  const q = courseQuery.value.trim().toLowerCase()
  const selected = new Set(selectedCourseIds.value.map(String))

  let list = (catalog.courses || []).filter(c => !selected.has(String(c.id)))
  if (!q) return list.slice(0, 24)

  list = list.filter(c => (`${c.code} ${c.title} ${c.level}`.toLowerCase().includes(q)))
  return list.slice(0, 24)
})

async function loadMyRequest() {
  try {
    const res = await apiFetch('/rep/my', { method: 'GET' })
    request.value = res?.data?.request || res?.request || null
  } catch {
    request.value = null
  }
}

async function refreshDeptCourses() {
  catalog.deptCourses = []
  if (!departmentId.value) return
  await catalog.fetchDeptCourses({ departmentId: departmentId.value, level: Number(level.value) || 0 })
}

async function submit() {
  error.value = ''
  ok.value = ''

  if (!hasStudySetup.value) {
    error.value = 'Complete your profile (faculty, department, level) first.'
    return
  }

  if (deptCourseIds.value.length === 0) {
    error.value = 'No department courses found for your selected department/level yet.'
    return
  }

  if (selectedCourseIds.value.length < 1) {
    error.value = 'Select at least one course you want to upload for.'
    return
  }

  if (!reason.value.trim()) {
    error.value = 'Tell the admin why you should be approved.'
    return
  }

  loading.value = true
  try {
    await apiFetch('/rep/request', {
      method: 'POST',
      body: {
        courseIds: selectedCourseIds.value,
        level: Number(level.value),
        reason: reason.value.trim(),
        proofUrl: proofUrl.value.trim(),
        // Optional hint for admins (won’t break if backend ignores)
        scope: mode.value === 'dept' ? 'department' : 'custom',
      },
    })

    ok.value = 'Request submitted. You’ll see the status update once an admin reviews it.'
    await loadMyRequest()
    courseQuery.value = ''
  } catch (e) {
    error.value = e?.message || 'Failed to submit request.'
  } finally {
    loading.value = false
  }
}

function goProfileToFix() {
  router.push('/profile')
}

onMounted(async () => {
  // ✅ OLD behavior was forcing approved reps/admins straight to uploads.
  // ✅ NEW: allow course reps when they came here in “more access” mode.
  if (isApprovedRole.value && !isMoreMode.value) {
    router.replace('/uploads')
    return
  }

  // Load global courses for labels + custom search
  await catalog.fetchCourses({})

  // Load existing request first (so we can block duplicates)
  await loadMyRequest()

  // Prepare dept courses
  if (departmentId.value) {
    await refreshDeptCourses()
  }

  // Preselect dept courses by default
  ensureDeptDefaultsSelected()
})

watch(level, async () => {
  error.value = ''
  ok.value = ''
  await refreshDeptCourses()
  ensureDeptDefaultsSelected()
})

watch(mode, () => {
  error.value = ''
  ok.value = ''
  if (mode.value === 'dept') ensureDeptDefaultsSelected()
})
</script>

<template>
  <div class="page">
    <!-- Header + existing request -->
    <AppCard class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-transparent" />
      <div class="relative">
        <div class="row">
          <div>
            <div class="h1">{{ pageTitle }}</div>
            <p class="sub mt-1">{{ pageSub }}</p>

            <div
              v-if="isMoreMode && role === 'course_rep'"
              class="mt-2 inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-white/5 border border-border/60"
            >
              <span class="badge bg-accent/15 border border-accent/30 text-text">Course rep</span>
              <span class="text-text-3">You can request extra course access here.</span>
            </div>
          </div>
          <RouterLink to="/profile" class="btn btn-ghost">Back</RouterLink>
        </div>

        <div v-if="!hasStudySetup" class="alert alert-danger mt-4" role="status">
          You must set your <b>Faculty</b>, <b>Department</b> and <b>Level</b> on your Profile first (then save).
          <div class="mt-3">
            <button class="btn btn-ghost" type="button" @click="goProfileToFix">Go to Profile</button>
          </div>
        </div>

        <div v-else-if="departmentId && deptCourseIds.length === 0" class="alert alert-danger mt-4" role="status">
          No department courses exist yet for your selected department/level.
          <div class="mt-2 text-xs text-text-3">
            This prevents wrong requests. Change department/level on your Profile, or contact an admin to add courses.
          </div>
          <div class="mt-3">
            <button class="btn btn-ghost" type="button" @click="goProfileToFix">Fix in Profile</button>
          </div>
        </div>

        <div v-if="request" class="mt-4 card card-pad">
          <div class="row">
            <div>
              <div class="text-sm font-extrabold">Your latest request</div>
              <div class="text-xs text-text-3 mt-1">
                Submitted: {{ formatDate(request.requestedAt || request.createdAt) }}
              </div>
            </div>
            <span :class="statusBadgeClass">{{ request.status }}</span>
          </div>

          <div class="mt-3 text-sm text-text-2">
            {{ request.reason }}
          </div>

          <div v-if="request.adminNote" class="alert alert-danger mt-3" role="note">
            Admin note: {{ request.adminNote }}
          </div>

          <div v-if="Array.isArray(request.courseIds) && request.courseIds.length" class="mt-3 flex flex-wrap gap-2">
            <span v-for="cid in request.courseIds" :key="cid" class="chip" :title="String(cid)">
              {{ byId.get(String(cid))?.code || cid }}
            </span>
          </div>

          <div v-if="requestStatus === 'pending'" class="alert alert-ok mt-4" role="status">
            Your request is pending review. You can’t submit another request until this one is reviewed.
          </div>
        </div>

        <div v-if="ok" class="alert alert-ok mt-4" role="status">{{ ok }}</div>
        <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
      </div>
    </AppCard>

    <!-- Submit -->
    <AppCard>
      <div class="row">
        <div>
          <div class="h2">Submit a new request</div>
          <p class="sub mt-1">
            This request is tied to your saved department & level. If you change department later, submit a new request.
          </p>
        </div>
        <button class="btn btn-ghost" type="button" :disabled="loading" @click="loadMyRequest">Refresh</button>
      </div>

      <div class="divider my-4" />

      <div v-if="requestStatus === 'pending'" class="alert alert-ok" role="status">
        You already have a pending request. Please wait for admin review.
      </div>

      <div v-else class="grid gap-4">
        <!-- Mode -->
        <div class="card card-pad">
          <div class="text-sm font-semibold">Request scope</div>
          <p class="sub mt-1">
            Department scope is recommended (faster approvals, cleaner uploads).
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-ghost"
              :class="mode === 'dept' ? 'ring-2 ring-accent/40' : ''"
              @click="mode = 'dept'"
            >
              Department scope (recommended)
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              :class="mode === 'custom' ? 'ring-2 ring-accent/40' : ''"
              @click="mode = 'custom'"
            >
              Custom courses
            </button>
          </div>

          <div v-if="mode === 'dept'" class="mt-3 text-xs text-text-3">
            We’ll auto-select your department courses for this level. You can still add/remove if needed.
          </div>
        </div>

        <!-- Level + proof -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="repLevel">Your level</label>
            <AppSelect id="repLevel" v-model="level" :options="levelOptions" placeholder="Select level…" />
            <p class="help">Used to load department courses for this level.</p>
          </div>

          <div>
            <label class="label" for="proof">Proof (optional link)</label>
            <input
              id="proof"
              v-model="proofUrl"
              class="input"
              placeholder="WhatsApp group link / screenshot link"
            />
            <p class="help">Paste anything that supports your request (optional).</p>
          </div>
        </div>

        <!-- Reason -->
        <div>
          <label class="label" for="reason">Why should you be approved?</label>
          <textarea
            id="reason"
            v-model="reason"
            class="input min-h-[110px]"
            placeholder="e.g. I'm the official class rep and I have access to past questions/materials for my class."
          />
        </div>

        <!-- Selected courses -->
        <div class="divider my-2" />

        <div class="row">
          <div>
            <div class="h2">Courses you want to upload for</div>
            <p class="sub mt-1">Select the courses you’ll manage uploads for.</p>
          </div>
          <span class="badge">{{ selectedCourseIds.length }} selected</span>
        </div>

        <div class="card card-pad">
          <div v-if="!departmentId" class="alert alert-danger" role="status">
            No department selected. Fix your profile first.
            <div class="mt-3">
              <button class="btn btn-ghost" type="button" @click="goProfileToFix">Go to Profile</button>
            </div>
          </div>

          <div v-else>
            <div class="text-xs text-text-3 mb-2">
              Tip: Your department courses are shown first. Add extra courses only if necessary.
            </div>

            <div class="grid gap-2 sm:grid-cols-2">
              <button
                v-for="c in deptCourses"
                :key="c.id"
                type="button"
                class="card card-press card-pad text-left"
                :class="selectedCourseIds.map(String).includes(String(c.id)) ? 'ring-2 ring-accent/50' : ''"
                @click="toggleCourse(c.id)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-sm font-extrabold truncate">{{ c.code }} — {{ c.title }}</div>
                    <div class="text-xs text-text-3 mt-1">
                      {{ selectedCourseIds.map(String).includes(String(c.id)) ? 'Selected' : 'Tap to select' }}
                    </div>
                  </div>
                  <span
                    class="badge"
                    :class="selectedCourseIds.map(String).includes(String(c.id)) ? 'bg-accent/15 border-accent/30 text-text' : ''"
                  >
                    {{ selectedCourseIds.map(String).includes(String(c.id)) ? '✓' : '+' }}
                  </span>
                </div>
              </button>
            </div>

            <!-- Custom add-on -->
            <div v-if="mode === 'custom'" class="mt-4">
              <label class="label">Add more courses (optional)</label>
              <input
                v-model="courseQuery"
                class="input"
                placeholder="Search course code or title…"
              />

              <div v-if="customCourseOptions.length" class="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  v-for="c in customCourseOptions"
                  :key="c.id"
                  type="button"
                  class="card card-press card-pad text-left"
                  @click="toggleCourse(c.id)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-sm font-extrabold truncate">{{ c.code }} — {{ c.title }} ({{ c.level }})</div>
                      <div class="text-xs text-text-3 mt-1">Tap to add</div>
                    </div>
                    <span class="badge">+</span>
                  </div>
                </button>
              </div>

              <div v-else class="help mt-2">
                {{ courseQuery ? 'No matches.' : 'Type to search and add.' }}
              </div>
            </div>

            <!-- Selected chips -->
            <div v-if="selectedCourses.length" class="mt-4">
              <div class="text-xs text-text-3 mb-2">Selected</div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="c in selectedCourses"
                  :key="c.id"
                  type="button"
                  class="chip"
                  :title="'Remove ' + c.code"
                  @click="removeSelected(c.id)"
                >
                  {{ c.code }} <span class="opacity-70">×</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Submit -->
        <div class="mt-2">
          <AppButton :disabled="!canSubmit" @click="submit">
            <span v-if="!loading">
              <span v-if="requestStatus === 'denied' || requestStatus === 'rejected'">Resubmit request</span>
              <span v-else>Submit request</span>
            </span>
            <span v-else>Submitting…</span>
          </AppButton>

          <div class="help mt-2">
            If you get denied, adjust your reason/proof and resubmit. Don’t spam multiple requests.
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
