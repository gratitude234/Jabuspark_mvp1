<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { apiFetch } from '../utils/api'

import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import AppSelect from '../components/AppSelect.vue'

const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()

const role = computed(() => auth.user?.role || 'student')

// ---- state ----
const loading = ref(false)
const error = ref('')
const ok = ref('')

const items = ref([])
const selectedId = ref('')
const selected = computed(() => items.value.find(x => String(x.id) === String(selectedId.value)) || null)

// filters
const statusFilter = ref('pending') // pending|approved|denied|all
const q = ref('')

// approve/deny workflow
const actionBusy = ref(false)
const actionError = ref('')
const actionOk = ref('')

const adminNote = ref('') // message to user on approve/deny
const denyReason = ref('') // optional structured reason
const approveCourseIds = ref([]) // admin editable scope

// course picker
const courseQuery = ref('')

// ---- helpers ----
function normItems(res) {
  if (Array.isArray(res)) return res
  if (Array.isArray(res?.data?.items)) return res.data.items
  if (Array.isArray(res?.items)) return res.items
  if (Array.isArray(res?.data)) return res.data
  return []
}

function asLower(x) {
  return String(x || '').toLowerCase()
}

function fmtDate(x) {
  if (!x) return ''
  try {
    const d = new Date(x)
    if (Number.isNaN(d.getTime())) return String(x)
    return d.toLocaleString()
  } catch {
    return String(x)
  }
}

function badgeForStatus(st) {
  const s = asLower(st)
  if (s === 'approved') return 'badge bg-accent/15 border border-accent/30 text-text'
  if (s === 'denied' || s === 'rejected') return 'badge bg-red-500/10 border border-red-500/25 text-red-200'
  if (s === 'pending') return 'badge bg-white/5 border border-border/60 text-text'
  return 'badge'
}

const courseById = computed(() => {
  const m = new Map()
  for (const c of (catalog.courses || [])) m.set(String(c.id), c)
  return m
})

function courseLabel(id) {
  const c = courseById.value.get(String(id))
  return c ? `${c.code} — ${c.title}` : String(id)
}

function getReqCourseIds(r) {
  const ids =
    r?.courseIds ||
    r?.course_ids ||
    r?.requestedCourseIds ||
    r?.requested_course_ids ||
    []
  return Array.isArray(ids) ? ids.map(x => String(x)) : []
}

function getStatus(r) {
  const st = r?.status || r?.state || ''
  const s = asLower(st)
  if (s === 'rejected') return 'denied'
  return s || 'pending'
}

function getUserName(r) {
  return r?.fullName || r?.full_name || r?.name || r?.userName || r?.user_name || 'Unknown'
}

function getUserMeta(r) {
  const dept = r?.departmentName || r?.department_name || r?.department || ''
  const lvl = r?.level || r?.userLevel || r?.user_level || ''
  const fac = r?.facultyName || r?.faculty_name || ''
  return { dept, lvl, fac }
}

function getProofUrl(r) {
  return r?.proofUrl || r?.proof_url || r?.evidenceUrl || r?.evidence_url || ''
}

function getReason(r) {
  return r?.reason || r?.message || r?.note || ''
}

function clearToasts() {
  error.value = ''
  ok.value = ''
  actionError.value = ''
  actionOk.value = ''
}

function selectRow(id) {
  selectedId.value = String(id)
  actionError.value = ''
  actionOk.value = ''
  adminNote.value = ''
  denyReason.value = ''

  const r = items.value.find(x => String(x.id) === String(id))
  if (r) {
    // default approve scope = requested scope
    approveCourseIds.value = [...getReqCourseIds(r)]
  }
}

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
  { value: 'all', label: 'All' },
]

const filtered = computed(() => {
  const s = statusFilter.value
  const query = asLower(q.value).trim()

  let list = [...items.value]

  if (s && s !== 'all') {
    list = list.filter(r => getStatus(r) === s)
  }

  if (query) {
    list = list.filter(r => {
      const name = asLower(getUserName(r))
      const meta = getUserMeta(r)
      const dept = asLower(meta.dept)
      const fac = asLower(meta.fac)
      const reason = asLower(getReason(r))
      const ids = getReqCourseIds(r)
      const courseText = ids.map(id => asLower(courseById.value.get(String(id))?.code || id)).join(' ')
      return (
        name.includes(query) ||
        dept.includes(query) ||
        fac.includes(query) ||
        reason.includes(query) ||
        courseText.includes(query) ||
        String(r?.id || '').includes(query)
      )
    })
  }

  // Sort: pending first, newest first within each
  list.sort((a, b) => {
    const sa = getStatus(a)
    const sb = getStatus(b)
    const pa = sa === 'pending' ? 0 : sa === 'denied' ? 1 : 2
    const pb = sb === 'pending' ? 0 : sb === 'denied' ? 1 : 2
    if (pa !== pb) return pa - pb
    const da = new Date(a?.requestedAt || a?.createdAt || 0).getTime()
    const db = new Date(b?.requestedAt || b?.createdAt || 0).getTime()
    return db - da
  })

  return list
})

const selectedRequestedCourses = computed(() => {
  if (!selected.value) return []
  return getReqCourseIds(selected.value)
})

const approveCoursesPretty = computed(() => {
  return approveCourseIds.value
    .map(id => courseById.value.get(String(id)))
    .filter(Boolean)
    .map(c => ({ id: String(c.id), code: c.code, title: c.title, level: c.level }))
})

const remainingApproveCourseOptions = computed(() => {
  const query = asLower(courseQuery.value).trim()
  const chosen = new Set(approveCourseIds.value.map(String))
  let list = (catalog.courses || []).filter(c => !chosen.has(String(c.id)))
  if (query) {
    list = list.filter(c => asLower(`${c.code} ${c.title} ${c.level}`).includes(query))
  }
  return list.slice(0, 24)
})

function addApproveCourse(id) {
  if (!id) return
  const sid = String(id)
  if (approveCourseIds.value.map(String).includes(sid)) return
  approveCourseIds.value.push(sid)
}

function removeApproveCourse(id) {
  const sid = String(id)
  approveCourseIds.value = approveCourseIds.value.filter(x => String(x) !== sid)
}

async function load() {
  clearToasts()
  loading.value = true
  try {
    const res = await apiFetch('/admin/rep-requests', { method: 'GET' })
    items.value = normItems(res)

    // Auto-select first pending
    if (!selectedId.value) {
      const first = items.value.find(r => getStatus(r) === 'pending') || items.value[0]
      if (first) selectRow(first.id)
    } else {
      // keep selection, but refresh editable scope defaults if the item changed
      const r = items.value.find(x => String(x.id) === String(selectedId.value))
      if (r) approveCourseIds.value = [...getReqCourseIds(r)]
    }
  } catch (e) {
    error.value = e?.message || 'Failed to load requests.'
  } finally {
    loading.value = false
  }
}

async function approve() {
  if (!selected.value) return
  clearToasts()

  if (approveCourseIds.value.length < 1) {
    actionError.value = 'Select at least one course to assign.'
    return
  }

  actionBusy.value = true
  try {
    // Send multiple keys for compatibility with your backend
    await apiFetch('/admin/rep-requests/approve', {
      method: 'POST',
      body: {
        id: selected.value.id,
        requestId: selected.value.id,
        courseIds: approveCourseIds.value,
        adminNote: adminNote.value.trim(),
        message: adminNote.value.trim(),
      },
    })

    actionOk.value = 'Approved. Rep access should update immediately.'
    await auth.refreshMe?.()
    await load()
  } catch (e) {
    actionError.value = e?.message || 'Approval failed.'
  } finally {
    actionBusy.value = false
  }
}

async function deny() {
  if (!selected.value) return
  clearToasts()

  const note = adminNote.value.trim()
  const reason = denyReason.value.trim()

  if (!note && !reason) {
    actionError.value = 'Provide a short admin note or reason before denying.'
    return
  }

  actionBusy.value = true
  try {
    await apiFetch('/admin/rep-requests/deny', {
      method: 'POST',
      body: {
        id: selected.value.id,
        requestId: selected.value.id,
        adminNote: note,
        message: note,
        reason,
      },
    })

    actionOk.value = 'Denied. The user will see your note.'
    await load()
  } catch (e) {
    actionError.value = e?.message || 'Deny failed.'
  } finally {
    actionBusy.value = false
  }
}

// ---- lifecycle ----
onMounted(async () => {
  if (role.value !== 'admin') {
    router.replace('/dashboard')
    return
  }

  // Load courses for readable request scopes
  await catalog.fetchCourses?.({})
  await load()
})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="row">
        <div>
          <div class="h1">Course Rep Requests</div>
          <p class="sub mt-1">Review and approve/deny upload access requests.</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost" :disabled="loading" @click="load">
            <span v-if="!loading">Refresh</span>
            <span v-else>Loading…</span>
          </button>
          <RouterLink to="/dashboard" class="btn btn-ghost">Back</RouterLink>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
      <div v-if="ok" class="alert alert-ok mt-4" role="status">{{ ok }}</div>

      <div class="divider my-4" />

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="sm:col-span-1">
          <label class="label">Status</label>
          <AppSelect v-model="statusFilter" :options="statusOptions" />
        </div>

        <div class="sm:col-span-2">
          <label class="label">Search</label>
          <input
            v-model="q"
            class="input w-full"
            placeholder="Search name, department, course code, reason…"
          />
        </div>
      </div>
    </AppCard>

    <div class="grid gap-4 lg:grid-cols-5">
      <!-- List -->
      <AppCard class="lg:col-span-2">
        <div class="row">
          <div>
            <div class="h2">Requests</div>
            <p class="sub mt-1">{{ filtered.length }} shown</p>
          </div>
        </div>

        <div class="divider my-4" />

        <div v-if="loading" class="sub">Loading…</div>

        <div v-else-if="filtered.length === 0" class="alert alert-ok" role="status">
          No requests match your filters.
        </div>

        <div v-else class="grid gap-2">
          <button
            v-for="r in filtered"
            :key="r.id"
            type="button"
            class="card card-press card-pad text-left"
            :class="String(r.id) === String(selectedId) ? 'ring-2 ring-accent/40' : ''"
            @click="selectRow(r.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">{{ getUserName(r) }}</div>
                <div class="text-xs text-text-3 mt-1">
                  <span v-if="getUserMeta(r).dept">{{ getUserMeta(r).dept }}</span>
                  <span v-if="getUserMeta(r).lvl"> • {{ getUserMeta(r).lvl }}L</span>
                </div>
                <div class="text-xs text-text-3 mt-1">
                  {{ fmtDate(r.requestedAt || r.createdAt) }}
                </div>
              </div>
              <span :class="badgeForStatus(getStatus(r))">{{ getStatus(r) }}</span>
            </div>

            <div class="mt-2 text-xs text-text-3 line-clamp-2">
              {{ getReason(r) || '—' }}
            </div>
          </button>
        </div>
      </AppCard>

      <!-- Details -->
      <AppCard class="lg:col-span-3">
        <div class="row">
          <div>
            <div class="h2">Details</div>
            <p class="sub mt-1">Approve with correct scope. Deny with clear feedback.</p>
          </div>
          <div v-if="selected" class="flex items-center gap-2">
            <span class="badge">ID: {{ selected.id }}</span>
            <span :class="badgeForStatus(getStatus(selected))">{{ getStatus(selected) }}</span>
          </div>
        </div>

        <div class="divider my-4" />

        <div v-if="!selected" class="alert alert-ok" role="status">
          Select a request from the list.
        </div>

        <div v-else class="grid gap-4">
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="text-sm font-semibold">Applicant</div>
            <div class="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
              <div><span class="text-text-3">Name:</span> <b>{{ getUserName(selected) }}</b></div>
              <div><span class="text-text-3">Status:</span> <b>{{ getStatus(selected) }}</b></div>
              <div><span class="text-text-3">Department:</span> <b>{{ getUserMeta(selected).dept || '—' }}</b></div>
              <div><span class="text-text-3">Level:</span> <b>{{ getUserMeta(selected).lvl || '—' }}</b></div>
              <div class="sm:col-span-2">
                <span class="text-text-3">Submitted:</span>
                <b>{{ fmtDate(selected.requestedAt || selected.createdAt) || '—' }}</b>
              </div>
            </div>

            <div class="mt-3">
              <div class="text-xs text-text-3 mb-1">Reason</div>
              <div class="text-sm">{{ getReason(selected) || '—' }}</div>
            </div>

            <div v-if="getProofUrl(selected)" class="mt-3">
              <div class="text-xs text-text-3 mb-1">Proof / evidence</div>
              <a class="btn btn-ghost btn-sm" :href="getProofUrl(selected)" target="_blank" rel="noreferrer">
                Open proof link
              </a>
            </div>
          </div>

          <!-- Requested courses -->
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="row">
              <div>
                <div class="text-sm font-semibold">Requested courses</div>
                <p class="sub mt-1">What the user asked for.</p>
              </div>
              <span class="badge">{{ selectedRequestedCourses.length }}</span>
            </div>

            <div v-if="selectedRequestedCourses.length === 0" class="help mt-2">No course ids attached.</div>

            <div v-else class="mt-2 flex flex-wrap gap-2">
              <span v-for="cid in selectedRequestedCourses" :key="cid" class="chip" :title="cid">
                {{ courseById.get(String(cid))?.code || cid }}
              </span>
            </div>
          </div>

          <!-- Approval scope editor -->
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="row">
              <div>
                <div class="text-sm font-semibold">Approve scope</div>
                <p class="sub mt-1">You can approve all requested courses or reduce scope.</p>
              </div>
              <span class="badge">{{ approveCourseIds.length }}</span>
            </div>

            <div class="mt-3">
              <div class="text-xs text-text-3 mb-2">Selected</div>
              <div v-if="approveCourseIds.length === 0" class="alert alert-danger" role="status">
                Add at least one course.
              </div>

              <div v-else class="flex flex-wrap gap-2">
                <button
                  v-for="c in approveCoursesPretty"
                  :key="c.id"
                  type="button"
                  class="chip"
                  :title="'Remove ' + c.code"
                  @click="removeApproveCourse(c.id)"
                >
                  {{ c.code }} <span class="opacity-70">×</span>
                </button>
              </div>
            </div>

            <div class="mt-4">
              <label class="label">Add more courses (optional)</label>
              <input v-model="courseQuery" class="input w-full" placeholder="Search course code or title…" />

              <div v-if="remainingApproveCourseOptions.length" class="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  v-for="c in remainingApproveCourseOptions"
                  :key="c.id"
                  type="button"
                  class="card card-press card-pad text-left"
                  @click="addApproveCourse(c.id)"
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
          </div>

          <!-- Admin message -->
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="text-sm font-semibold">Admin note (shown to user)</div>
            <p class="sub mt-1">Explain your decision or give next steps. Highly recommended on deny.</p>
            <textarea
              v-model="adminNote"
              class="input min-h-[110px] mt-3"
              placeholder="e.g., Approved. Upload only PDF scans. Use correct session/semester."
            />
            <div class="mt-3">
              <label class="label">Deny reason (optional)</label>
              <input
                v-model="denyReason"
                class="input w-full"
                placeholder="e.g., Not verified / insufficient proof / wrong department"
              />
            </div>

            <div v-if="actionError" class="alert alert-danger mt-4" role="alert">{{ actionError }}</div>
            <div v-if="actionOk" class="alert alert-ok mt-4" role="status">{{ actionOk }}</div>

            <div class="mt-4 flex flex-col sm:flex-row gap-2">
              <AppButton
                class="btn-primary"
                :disabled="actionBusy || getStatus(selected) !== 'pending'"
                @click="approve"
              >
                <span v-if="!actionBusy">Approve</span>
                <span v-else>Working…</span>
              </AppButton>

              <button
                class="btn btn-ghost"
                type="button"
                :disabled="actionBusy || getStatus(selected) !== 'pending'"
                @click="deny"
              >
                Deny
              </button>

              <button
                class="btn btn-ghost"
                type="button"
                :disabled="actionBusy"
                @click="selectRow(selected.id)"
              >
                Reset draft
              </button>
            </div>

            <div class="mt-3 text-xs text-text-3">
              Note: Approve/Deny buttons are only enabled for <b>pending</b> requests.
            </div>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>
