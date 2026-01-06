<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '../utils/api'
import { useCatalogStore } from '../stores/catalog'
import { useAuthStore } from '../stores/auth'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppInput from '../components/AppInput.vue'
import AppButton from '../components/AppButton.vue'

const auth = useAuthStore()
const catalog = useCatalogStore()

const q = ref('')
const departmentId = ref('')
const courseId = ref('')

const busy = ref(false)
const error = ref('')
const reps = ref([])

const courseOptions = computed(() => (catalog.courses || []).map(c => ({ value: c.id, label: `${c.code} — ${c.title} (${c.level})` })))
const deptOptions = computed(() => (catalog.departments || []).map(d => ({ value: d.id, label: d.name })))

const courseById = computed(() => new Map((catalog.courses || []).map(c => [c.id, c])))

function labelCourse(id) {
  const c = courseById.value.get(id)
  return c ? `${c.code}` : id
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

async function load() {
  error.value = ''
  busy.value = true
  try {
    const res = await apiFetch(`/admin/course-reps${qs({ q: q.value, departmentId: departmentId.value, courseId: courseId.value })}`)
    reps.value = res?.data?.courseReps || []
  } catch (e) {
    error.value = e?.message || 'Failed to load course reps.'
  } finally {
    busy.value = false
  }
}

async function assignCourse(repId, newCourseId) {
  if (!newCourseId) return
  try {
    await apiFetch('/admin/course-reps/assign', { method: 'POST', body: { userId: repId, courseId: newCourseId } })
    await load()
  } catch (e) {
    error.value = e?.message || 'Failed to assign course.'
  }
}

async function unassignCourse(repId, cid) {
  try {
    await apiFetch('/admin/course-reps/unassign', { method: 'POST', body: { userId: repId, courseId: cid } })
    await load()
  } catch (e) {
    error.value = e?.message || 'Failed to remove course.'
  }
}

async function toggleUploads(repId, disabled) {
  try {
    // Backend accepts both {uploadsDisabled} and legacy {disabled}
    await apiFetch('/admin/course-reps/uploads-disabled', {
      method: 'POST',
      body: { userId: repId, uploadsDisabled: !!disabled, disabled: !!disabled },
    })
    await load()
  } catch (e) {
    error.value = e?.message || 'Failed to update rep.'
  }
}

async function suspend(repId) {
  if (!confirm('Suspend this rep? They will be reverted to student and lose all assigned courses.')) return
  try {
    await apiFetch('/admin/course-reps/suspend', { method: 'POST', body: { userId: repId } })
    await load()
  } catch (e) {
    error.value = e?.message || 'Failed to suspend rep.'
  }
}

onMounted(async () => {
  if (auth.user?.role !== 'admin') return
  await catalog.bootstrap()
  await catalog.fetchCourses()
  await load()
})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="h1">Manage Course Reps</div>
          <p class="sub mt-1">Assign/unassign courses, disable uploads, or suspend reps.</p>
        </div>
        <AppButton class="w-full sm:w-auto" :disabled="busy" @click="load">Refresh</AppButton>
      </div>

      <div class="divider my-4" />

      <div class="grid gap-3 sm:grid-cols-3">
        <div>
          <label class="label">Search</label>
          <AppInput v-model="q" placeholder="Name or email" />
        </div>
        <div>
          <label class="label">Department</label>
          <AppSelect v-model="departmentId" :options="[{value:'',label:'All departments'}, ...deptOptions]" />
        </div>
        <div>
          <label class="label">Course</label>
          <AppSelect v-model="courseId" :options="[{value:'',label:'All courses'}, ...courseOptions]" />
        </div>
      </div>

      <div class="mt-3 flex gap-2">
        <AppButton :disabled="busy" @click="load">Apply filters</AppButton>
        <button class="btn btn-ghost" :disabled="busy" @click="q=''; departmentId=''; courseId=''; load()">Clear</button>
      </div>

      <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
    </AppCard>

    <div v-if="busy" class="sub">Loading…</div>

    <div v-else class="grid gap-3">
      <AppCard v-if="reps.length === 0">
        <div class="sub">No course reps found.</div>
      </AppCard>

      <AppCard v-for="r in reps" :key="r.id" class="relative overflow-hidden">
        <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
        <div class="relative">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div class="h2">{{ r.fullName || 'Unnamed' }}</div>
              <div class="sub">{{ r.email }}</div>
              <div class="mt-1 flex flex-wrap gap-2">
                <span class="badge">Role: {{ r.role }}</span>
                <span v-if="r.uploadsDisabled" class="badge text-warn">Uploads disabled</span>
              </div>
            </div>

            <div class="flex flex-col sm:items-end gap-2">
              <button
                class="btn"
                :class="r.uploadsDisabled ? 'btn-primary' : 'btn-ghost'"
                @click="toggleUploads(r.id, !r.uploadsDisabled)"
              >
                {{ r.uploadsDisabled ? 'Enable uploads' : 'Disable uploads' }}
              </button>
              <button class="btn btn-danger" @click="suspend(r.id)">Suspend</button>
            </div>
          </div>

          <div class="divider my-4" />

          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="h2">Assigned courses</div>
              <p class="sub mt-1">These are the only courses this rep can upload for.</p>
            </div>
            <span class="badge">{{ r.assignments?.length || 0 }}</span>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <div v-if="(r.assignments?.length || 0) === 0" class="sub">No assigned courses.</div>
            <button
              v-for="a in (r.assignments || [])"
              :key="a.courseId"
              class="chip hover:bg-white/[0.06] active:bg-white/[0.08]"
              title="Click to remove"
              @click="unassignCourse(r.id, a.courseId)"
            >
              {{ labelCourse(a.courseId) }} <span class="muted">✕</span>
            </button>
          </div>

          <div class="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <AppSelect
              v-model="r._assignCourseId"
              :options="[{value:'',label:'Select course to assign…'}, ...courseOptions]"
            />
            <AppButton class="w-full sm:w-auto" @click="assignCourse(r.id, r._assignCourseId); r._assignCourseId=''">Add</AppButton>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>
