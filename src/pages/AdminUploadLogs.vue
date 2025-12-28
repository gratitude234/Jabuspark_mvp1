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

const entityType = ref('')
const action = ref('')
const courseId = ref('')
const q = ref('')

const busy = ref(false)
const error = ref('')
const logs = ref([])

const courseOptions = computed(() => (catalog.courses || []).map(c => ({ value: c.id, label: `${c.code} — ${c.title} (${c.level})` })))
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
    const res = await apiFetch(`/admin/upload-audit${qs({ entityType: entityType.value, action: action.value, courseId: courseId.value, q: q.value })}`)
    logs.value = res?.data?.logs || []
  } catch (e) {
    error.value = e?.message || 'Failed to load audit logs.'
  } finally {
    busy.value = false
  }
}

const typeOptions = [
  { value: '', label: 'All types' },
  { value: 'past_question', label: 'Past questions' },
  { value: 'material', label: 'Materials' },
]

const actionOptions = [
  { value: '', label: 'All actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
]

function prettyDetails(d) {
  if (!d) return ''
  try {
    return JSON.stringify(d, null, 2)
  } catch {
    return ''
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
          <div class="h1">Upload Audit Log</div>
          <p class="sub mt-1">Tracks uploads, edits, and deletes for past questions and materials.</p>
        </div>
        <AppButton class="w-full sm:w-auto" :disabled="busy" @click="load">Refresh</AppButton>
      </div>

      <div class="divider my-4" />

      <div class="grid gap-3 sm:grid-cols-4">
        <div>
          <label class="label">Type</label>
          <AppSelect v-model="entityType" :options="typeOptions" />
        </div>
        <div>
          <label class="label">Action</label>
          <AppSelect v-model="action" :options="actionOptions" />
        </div>
        <div>
          <label class="label">Course</label>
          <AppSelect v-model="courseId" :options="[{value:'',label:'All courses'}, ...courseOptions]" />
        </div>
        <div>
          <label class="label">Search</label>
          <AppInput v-model="q" placeholder="Actor, target, entity id" />
        </div>
      </div>

      <div class="mt-3 flex gap-2">
        <AppButton :disabled="busy" @click="load">Apply</AppButton>
        <button class="btn btn-ghost" :disabled="busy" @click="entityType=''; action=''; courseId=''; q=''; load()">Clear</button>
      </div>

      <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
    </AppCard>

    <div v-if="busy" class="sub">Loading…</div>

    <AppCard v-else-if="logs.length === 0">
      <div class="sub">No audit events yet (or migration not applied).</div>
    </AppCard>

    <div v-else class="grid gap-3">
      <AppCard v-for="l in logs" :key="l.id">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div class="h2">
              <span class="badge">{{ l.action }}</span>
              <span class="badge ml-2">{{ l.entityType }}</span>
              <span v-if="l.courseId" class="badge ml-2">{{ labelCourse(l.courseId) }}</span>
            </div>
            <p class="sub mt-1">
              <span class="muted">Entity:</span> {{ l.entityId }}
              <span v-if="l.filePath" class="muted"> • </span>
              <span v-if="l.filePath" class="muted">{{ l.filePath }}</span>
            </p>
            <p class="sub">
              <span class="muted">When:</span> {{ l.createdAt }}
            </p>
            <p v-if="l.actor" class="sub">
              <span class="muted">Actor:</span> {{ l.actor.fullName || l.actor.email }}
              <span v-if="l.target" class="muted"> • </span>
              <span v-if="l.target" class="muted">Target:</span>
              <span v-if="l.target"> {{ l.target.fullName || l.target.email }}</span>
            </p>
          </div>
        </div>

        <details v-if="l.details" class="mt-3">
          <summary class="sub cursor-pointer">Details</summary>
          <pre class="mt-2 rounded-xl2 bg-surface-2 border border-stroke/60 p-3 text-xs overflow-auto">{{ prettyDetails(l.details) }}</pre>
        </details>
      </AppCard>
    </div>
  </div>
</template>
