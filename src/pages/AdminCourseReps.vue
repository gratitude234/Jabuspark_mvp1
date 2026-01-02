<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../utils/api'
import { useCatalogStore } from '../stores/catalog'
import { useAuthStore } from '../stores/auth'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppInput from '../components/AppInput.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()

// filters (server-supported)
const q = ref('')
const departmentId = ref('')
const courseId = ref('')

// filters (client-only)
const statusFilter = ref('all') // all | active | disabled
const roleFilter = ref('all') // all | course_rep | student | admin

const busy = ref(false)
const error = ref('')
const ok = ref('')

const reps = ref([])

// selection
const selectedId = ref('')
const selected = computed(() => reps.value.find(r => String(r.id) === String(selectedId.value)) || null)

// per-rep action state (simple maps)
const actionBusy = ref({})
const rowMsg = ref({}) // { [id]: { ok?: string, error?: string } }

// assignment draft (for selected rep)
const assignQuery = ref('')
const addIds = ref([]) // selected course ids to add (bulk)
const removeIds = ref([]) // selected course ids to remove (bulk)

function setRowMsg(id, payload) {
  rowMsg.value = { ...rowMsg.value, [String(id)]: payload }
  // auto-clear after a bit
  setTimeout(() => {
    const next = { ...rowMsg.value }
    delete next[String(id)]
    rowMsg.value = next
  }, 3500)
}

function setActionBusy(id, v) {
  actionBusy.value = { ...actionBusy.value, [String(id)]: !!v }
}

function qs(params) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined) return
    const s = String(v)
    if (s.trim() === '') return
    sp.set(k, s)
  })
  const str = sp.toString()
  return str ? `?${str}` : ''
}

const courseById = computed(() => new Map((catalog.courses || []).map(c => [String(c.id), c])))

function courseLabel(id) {
  const c = courseById.value.get(String(id))
  if (!c) return String(id)
  return `${c.code} — ${c.title} (${c.level})`
}

function courseCode(id) {
  const c = courseById.value.get(String(id))
  return c ? c.code : String(id)
}

const courseOptions = computed(() =>
  (catalog.courses || []).map(c => ({
    value: c.id,
    label: `${c.code} — ${c.title} (${c.level})`,
  }))
)

const deptOptions = computed(() =>
  (catalog.departments || []).map(d => ({
    value: d.id,
    label: d.name,
  }))
)

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Uploads enabled' },
  { value: 'disabled', label: 'Uploads disabled' },
]

const roleOptions = [
  { value: 'all', label: 'All roles' },
  { value: 'course_rep', label: 'Course reps' },
  { value: 'student', label: 'Students' },
  { value: 'admin', label: 'Admins' },
]

// normalize assignments
function assignedIdsOf(r) {
  const list = Array.isArray(r?.assignments) ? r.assignments : []
  return list.map(a => String(a.courseId))
}

const filtered = computed(() => {
  let list = [...reps.value]

  // client filters
  if (statusFilter.value === 'active') list = list.filter(r => !r.uploadsDisabled)
  if (statusFilter.value === 'disabled') list = list.filter(r => !!r.uploadsDisabled)

  if (roleFilter.value !== 'all') list = list.filter(r => String(r.role || '') === roleFilter.value)

  // quick sort: uploads-disabled last, then more assignments first, then name
  list.sort((a, b) => {
    const da = a.uploadsDisabled ? 1 : 0
    const db = b.uploadsDisabled ? 1 : 0
    if (da !== db) return da - db
    const aa = (a.assignments?.length || 0)
    const ab = (b.assignments?.length || 0)
    if (aa !== ab) return ab - aa
    return String(a.fullName || '').localeCompare(String(b.fullName || ''))
  })

  return list
})

function selectRep(id) {
  selectedId.value = String(id)
  // reset drafts
  assignQuery.value = ''
  addIds.value = []
  removeIds.value = []
}

watch(selectedId, () => {
  // ensure selection exists after reload
  if (selectedId.value && !selected.value) selectedId.value = ''
})

// assign search options (only for selected rep)
const assignChoices = computed(() => {
  if (!selected.value) return []
  const existing = new Set(assignedIdsOf(selected.value))
  const picked = new Set(addIds.value.map(String))
  const qv = assignQuery.value.trim().toLowerCase()

  let list = (catalog.courses || []).filter(c => !existing.has(String(c.id)) && !picked.has(String(c.id)))
  if (qv) list = list.filter(c => `${c.code} ${c.title} ${c.level}`.toLowerCase().includes(qv))
  return list.slice(0, 24)
})

function togglePickAdd(id) {
  const sid = String(id)
  const i = addIds.value.findIndex(x => String(x) === sid)
  if (i >= 0) addIds.value.splice(i, 1)
  else addIds.value.push(sid)
}

function togglePickRemove(id) {
  const sid = String(id)
  const i = removeIds.value.findIndex(x => String(x) === sid)
  if (i >= 0) removeIds.value.splice(i, 1)
  else removeIds.value.push(sid)
}

async function load() {
  error.value = ''
  ok.value = ''
  busy.value = true

  try {
    const res = await apiFetch(
      `/admin/course-reps${qs({
        q: q.value,
        departmentId: departmentId.value,
        courseId: courseId.value,
      })}`
    )
    reps.value = res?.data?.courseReps || []

    // auto-select the first rep if none selected
    if (!selectedId.value && reps.value.length) {
      selectRep(reps.value[0].id)
    }

    // if current selected disappeared, clear it
    if (selectedId.value && !selected.value) selectedId.value = ''
  } catch (e) {
    error.value = e?.message || 'Failed to load course reps.'
  } finally {
    busy.value = false
  }
}

async function toggleUploads(repId, disabled) {
  const rid = String(repId)
  setActionBusy(rid, true)
  try {
    if (disabled) {
      const yes = confirm('Disable uploads for this rep? They will not be able to upload until re-enabled.')
      if (!yes) return
    }
    await apiFetch('/admin/course-reps/uploads-disabled', {
      method: 'POST',
      body: { userId: repId, disabled },
    })
    setRowMsg(rid, { ok: disabled ? 'Uploads disabled.' : 'Uploads enabled.' })
    await load()
  } catch (e) {
    setRowMsg(rid, { error: e?.message || 'Failed to update uploads status.' })
  } finally {
    setActionBusy(rid, false)
  }
}

async function suspend(repId) {
  const rid = String(repId)
  const yes = confirm('Suspend this rep? They will be reverted to student and lose all assigned courses.')
  if (!yes) return

  setActionBusy(rid, true)
  try {
    await apiFetch('/admin/course-reps/suspend', { method: 'POST', body: { userId: repId } })
    setRowMsg(rid, { ok: 'Suspended.' })
    // if you suspended the selected rep, clear selection
    if (String(selectedId.value) === rid) selectedId.value = ''
    await load()
  } catch (e) {
    setRowMsg(rid, { error: e?.message || 'Failed to suspend rep.' })
  } finally {
    setActionBusy(rid, false)
  }
}

// bulk add
async function addSelectedCourses() {
  if (!selected.value) return
  if (addIds.value.length < 1) return

  const rid = String(selected.value.id)
  setActionBusy(rid, true)
  setRowMsg(rid, {})

  try {
    for (const cid of addIds.value) {
      await apiFetch('/admin/course-reps/assign', {
        method: 'POST',
        body: { userId: selected.value.id, courseId: cid },
      })
    }
    setRowMsg(rid, { ok: `Added ${addIds.value.length} course(s).` })
    addIds.value = []
    assignQuery.value = ''
    await load()
  } catch (e) {
    setRowMsg(rid, { error: e?.message || 'Failed to assign course(s).' })
  } finally {
    setActionBusy(rid, false)
  }
}

// bulk remove
async function removeSelectedCourses() {
  if (!selected.value) return
  if (removeIds.value.length < 1) return

  const rid = String(selected.value.id)
  const yes = confirm(`Remove ${removeIds.value.length} course(s) from this rep?`)
  if (!yes) return

  setActionBusy(rid, true)
  setRowMsg(rid, {})

  try {
    for (const cid of removeIds.value) {
      await apiFetch('/admin/course-reps/unassign', {
        method: 'POST',
        body: { userId: selected.value.id, courseId: cid },
      })
    }
    setRowMsg(rid, { ok: `Removed ${removeIds.value.length} course(s).` })
    removeIds.value = []
    await load()
  } catch (e) {
    setRowMsg(rid, { error: e?.message || 'Failed to remove course(s).' })
  } finally {
    setActionBusy(rid, false)
  }
}

function clearFilters() {
  q.value = ''
  departmentId.value = ''
  courseId.value = ''
  statusFilter.value = 'all'
  roleFilter.value = 'all'
  load()
}

onMounted(async () => {
  if (auth.user?.role !== 'admin') {
    router.replace('/dashboard')
    return
  }
  await catalog.bootstrap()
  await catalog.fetchCourses()
  await load()
})
</script>

<template>
  <div class="page">
    <AppCard class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-transparent" />
      <div class="relative">
        <div class="row">
          <div>
            <div class="h1">Manage Course Reps</div>
            <p class="sub mt-1">
              Perfect flow: find rep → confirm scope → assign/remove courses → toggle uploads → suspend if needed.
            </p>
          </div>
          <div class="flex flex-col sm:flex-row gap-2">
            <button class="btn btn-ghost" :disabled="busy" @click="load">
              <span v-if="!busy">Refresh</span>
              <span v-else>Loading…</span>
            </button>
            <RouterLink to="/dashboard" class="btn btn-ghost">Back</RouterLink>
          </div>
        </div>

        <div class="divider my-4" />

        <div class="grid gap-3 sm:grid-cols-6">
          <div class="sm:col-span-2">
            <label class="label">Search</label>
            <AppInput v-model="q" placeholder="Name or email" />
          </div>

          <div class="sm:col-span-2">
            <label class="label">Department</label>
            <AppSelect
              v-model="departmentId"
              :options="[{ value: '', label: 'All departments' }, ...deptOptions]"
              placeholder="All departments"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="label">Course</label>
            <AppSelect
              v-model="courseId"
              :options="[{ value: '', label: 'All courses' }, ...courseOptions]"
              placeholder="All courses"
            />
          </div>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-6">
          <div class="sm:col-span-2">
            <label class="label">Uploads status</label>
            <AppSelect v-model="statusFilter" :options="statusOptions" />
          </div>

          <div class="sm:col-span-2">
            <label class="label">Role</label>
            <AppSelect v-model="roleFilter" :options="roleOptions" />
          </div>

          <div class="sm:col-span-2 flex items-end gap-2">
            <AppButton class="w-full" :disabled="busy" @click="load">Apply</AppButton>
            <button class="btn btn-ghost w-full" :disabled="busy" @click="clearFilters">Clear</button>
          </div>
        </div>

        <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
        <div v-if="ok" class="alert alert-ok mt-4" role="status">{{ ok }}</div>
      </div>
    </AppCard>

    <div class="grid gap-4 lg:grid-cols-5">
      <!-- Left: reps list -->
      <AppCard class="lg:col-span-2">
        <div class="row">
          <div>
            <div class="h2">Reps</div>
            <p class="sub mt-1">
              {{ filtered.length }} found
              <span class="text-text-3">• click one to manage</span>
            </p>
          </div>
        </div>

        <div class="divider my-4" />

        <div v-if="busy" class="sub">Loading…</div>

        <div v-else-if="filtered.length === 0" class="alert alert-ok" role="status">
          No course reps match these filters.
        </div>

        <div v-else class="grid gap-2">
          <button
            v-for="r in filtered"
            :key="r.id"
            type="button"
            class="card card-press card-pad text-left"
            :class="String(r.id) === String(selectedId) ? 'ring-2 ring-accent/40' : ''"
            @click="selectRep(r.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">
                  {{ r.fullName || 'Unnamed' }}
                  <span class="text-text-3 font-normal">({{ r.email }})</span>
                </div>
                <div class="mt-1 flex flex-wrap gap-2">
                  <span class="badge">Role: {{ r.role }}</span>
                  <span v-if="r.uploadsDisabled" class="badge text-warn">Uploads disabled</span>
                  <span class="badge">{{ r.assignments?.length || 0 }} course(s)</span>
                </div>

                <div v-if="rowMsg[String(r.id)]?.ok" class="text-xs text-accent mt-2">
                  {{ rowMsg[String(r.id)]?.ok }}
                </div>
                <div v-if="rowMsg[String(r.id)]?.error" class="text-xs text-red-200 mt-2">
                  {{ rowMsg[String(r.id)]?.error }}
                </div>
              </div>

              <span class="badge" :class="r.uploadsDisabled ? 'bg-white/5' : 'bg-accent/15 border-accent/30'">
                {{ r.uploadsDisabled ? 'off' : 'on' }}
              </span>
            </div>
          </button>
        </div>
      </AppCard>

      <!-- Right: selected rep details -->
      <AppCard class="lg:col-span-3">
        <div class="row">
          <div>
            <div class="h2">Manage rep</div>
            <p class="sub mt-1">Assign exactly what they’re allowed to upload for.</p>
          </div>
          <div v-if="selected" class="flex flex-wrap gap-2 justify-end">
            <span class="badge">ID: {{ selected.id }}</span>
            <span class="badge">Role: {{ selected.role }}</span>
            <span v-if="selected.uploadsDisabled" class="badge text-warn">Uploads disabled</span>
          </div>
        </div>

        <div class="divider my-4" />

        <div v-if="!selected" class="alert alert-ok" role="status">
          Select a rep from the left list to manage.
        </div>

        <div v-else class="grid gap-4">
          <!-- Header/actions -->
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="text-xl font-extrabold truncate">{{ selected.fullName || 'Unnamed' }}</div>
                <div class="sub truncate">{{ selected.email }}</div>
                <div class="mt-2 text-xs text-text-3">
                  Tip: keep scope tight. Only assign courses they truly own.
                </div>
              </div>

              <div class="flex flex-col sm:items-end gap-2">
                <button
                  class="btn"
                  :class="selected.uploadsDisabled ? 'btn-primary' : 'btn-ghost'"
                  :disabled="!!actionBusy[String(selected.id)]"
                  @click="toggleUploads(selected.id, !selected.uploadsDisabled)"
                >
                  {{ selected.uploadsDisabled ? 'Enable uploads' : 'Disable uploads' }}
                </button>

                <button
                  class="btn btn-danger"
                  :disabled="!!actionBusy[String(selected.id)]"
                  @click="suspend(selected.id)"
                >
                  Suspend
                </button>
              </div>
            </div>

            <div v-if="rowMsg[String(selected.id)]?.ok" class="alert alert-ok mt-3" role="status">
              {{ rowMsg[String(selected.id)]?.ok }}
            </div>
            <div v-if="rowMsg[String(selected.id)]?.error" class="alert alert-danger mt-3" role="alert">
              {{ rowMsg[String(selected.id)]?.error }}
            </div>
          </div>

          <!-- Assigned courses -->
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="row">
              <div>
                <div class="h2">Assigned courses</div>
                <p class="sub mt-1">Click to mark for removal, then remove in one action.</p>
              </div>
              <span class="badge">{{ selected.assignments?.length || 0 }}</span>
            </div>

            <div class="divider my-4" />

            <div v-if="(selected.assignments?.length || 0) === 0" class="alert alert-ok" role="status">
              No assigned courses yet.
            </div>

            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="a in (selected.assignments || [])"
                :key="a.courseId"
                type="button"
                class="chip"
                :class="removeIds.includes(String(a.courseId)) ? 'ring-2 ring-red-500/40 bg-red-500/10' : ''"
                :title="removeIds.includes(String(a.courseId)) ? 'Selected for removal' : 'Click to select for removal'"
                @click="togglePickRemove(a.courseId)"
              >
                {{ courseCode(a.courseId) }}
                <span class="opacity-70">•</span>
                <span class="opacity-90">{{ removeIds.includes(String(a.courseId)) ? 'remove' : 'keep' }}</span>
              </button>
            </div>

            <div class="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                class="btn btn-ghost"
                type="button"
                :disabled="removeIds.length === 0 || !!actionBusy[String(selected.id)]"
                @click="removeSelectedCourses"
              >
                Remove selected ({{ removeIds.length }})
              </button>

              <button
                class="btn btn-ghost"
                type="button"
                :disabled="removeIds.length === 0 || !!actionBusy[String(selected.id)]"
                @click="removeIds = []"
              >
                Clear selection
              </button>
            </div>
          </div>

          <!-- Add courses (bulk) -->
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="row">
              <div>
                <div class="h2">Add courses</div>
                <p class="sub mt-1">Search and select multiple courses, then add once.</p>
              </div>
              <span class="badge">{{ addIds.length }}</span>
            </div>

            <div class="divider my-4" />

            <label class="label">Search courses</label>
            <input v-model="assignQuery" class="input w-full" placeholder="e.g. GST 211, CSC201…" />

            <div class="mt-3">
              <div v-if="addIds.length" class="text-xs text-text-3 mb-2">Selected to add</div>
              <div v-if="addIds.length" class="flex flex-wrap gap-2">
                <button
                  v-for="cid in addIds"
                  :key="cid"
                  type="button"
                  class="chip"
                  :title="courseLabel(cid) + ' (click to remove from list)'"
                  @click="togglePickAdd(cid)"
                >
                  {{ courseCode(cid) }} <span class="opacity-70">×</span>
                </button>
              </div>

              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  v-for="c in assignChoices"
                  :key="c.id"
                  type="button"
                  class="card card-press card-pad text-left"
                  @click="togglePickAdd(c.id)"
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

              <div v-if="assignChoices.length === 0" class="help mt-3">
                {{ assignQuery ? 'No courses match your search.' : 'Search to add courses not already assigned.' }}
              </div>
            </div>

            <div class="mt-4 flex flex-col sm:flex-row gap-2">
              <AppButton
                class="w-full sm:w-auto"
                :disabled="addIds.length === 0 || !!actionBusy[String(selected.id)]"
                @click="addSelectedCourses"
              >
                Add selected ({{ addIds.length }})
              </AppButton>

              <button
                class="btn btn-ghost w-full sm:w-auto"
                type="button"
                :disabled="addIds.length === 0 || !!actionBusy[String(selected.id)]"
                @click="addIds = []"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Readable scope preview -->
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="text-sm font-semibold">Upload scope preview</div>
            <p class="sub mt-1">This is what the rep should be allowed to upload for.</p>

            <div class="divider my-4" />

            <div class="grid gap-2">
              <div v-for="a in (selected.assignments || [])" :key="a.courseId" class="text-sm">
                • {{ courseLabel(a.courseId) }}
              </div>

              <div v-if="(selected.assignments?.length || 0) === 0" class="text-sm text-text-3">
                No scope yet — assign at least one course.
              </div>
            </div>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>
