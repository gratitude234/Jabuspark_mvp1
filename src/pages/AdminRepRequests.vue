<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiFetch } from '../utils/api'
import { useCatalogStore } from '../stores/catalog'

import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const catalog = useCatalogStore()

const loading = ref(false)
const error = ref('')
const ok = ref('')
const status = ref('pending')
const items = ref([])

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
]

async function load() {
  loading.value = true
  error.value = ''
  ok.value = ''
  try {
    const res = await apiFetch(`/admin/rep-requests?status=${encodeURIComponent(status.value)}`)
    items.value = res?.data?.requests || []
  } catch (e) {
    error.value = e?.message || 'Failed to load requests'
    items.value = []
  } finally {
    loading.value = false
  }
}

const courseMap = computed(() => {
  const m = new Map()
  for (const c of (catalog.courses || [])) {
    m.set(c.id, `${c.code} — ${c.title} (${c.level})`)
  }
  return m
})

function courseLabel(c) {
  return c?.label || courseMap.value.get(c?.id) || c?.id
}

async function approve(requestId, courseIds = [], adminNote = '') {
  error.value = ''
  ok.value = ''
  try {
    await apiFetch('/admin/rep-requests/approve', {
      method: 'POST',
      body: { requestId, courseIds, adminNote }
    })
    ok.value = 'Approved successfully.'
    await load()
  } catch (e) {
    error.value = e?.message || 'Failed to approve'
  }
}

async function deny(requestId, adminNote = '') {
  error.value = ''
  ok.value = ''
  try {
    await apiFetch('/admin/rep-requests/deny', {
      method: 'POST',
      body: { requestId, adminNote }
    })
    ok.value = 'Denied.'
    await load()
  } catch (e) {
    error.value = e?.message || 'Failed to deny'
  }
}

onMounted(async () => {
  await catalog.fetchCourses({})
  await load()
})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="row">
        <div>
          <div class="h1">Rep Requests</div>
          <p class="sub mt-1">Review course rep requests and approve/deny them.</p>
        </div>
        <RouterLink to="/profile" class="btn btn-ghost">Back</RouterLink>
      </div>

      <div class="divider my-4" />

      <div class="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div class="min-w-[220px]">
          <label class="label">Status filter</label>
          <AppSelect v-model="status" :options="statusOptions" />
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost" :disabled="loading" @click="load">Refresh</button>
        </div>
      </div>

      <div v-if="ok" class="alert alert-ok mt-4" role="status">{{ ok }}</div>
      <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
    </AppCard>

    <AppCard>
      <div class="row">
        <div>
          <div class="h2">Requests</div>
          <p class="sub mt-1">{{ items.length }} item(s)</p>
        </div>
        <span v-if="loading" class="badge">Loading…</span>
      </div>

      <div class="divider my-4" />

      <div v-if="!loading && items.length === 0" class="alert alert-ok" role="status">
        No requests found for this status.
      </div>

      <div v-else class="grid gap-3">
        <div v-for="r in items" :key="r.id" class="card card-pad">
          <div class="row">
            <div class="min-w-0">
              <div class="text-sm font-extrabold truncate">{{ r.user.fullName }} <span class="text-text-3 font-normal">({{ r.user.email }})</span></div>
              <div class="text-xs text-text-3 mt-1">Requested: {{ r.requestedAt }}</div>
            </div>
            <span class="badge">{{ r.status }}</span>
          </div>

          <div class="mt-3 text-sm text-text-2">
            <div class="text-xs text-text-3 mb-1">Reason</div>
            {{ r.reason }}
          </div>

          <div class="mt-3">
            <div class="text-xs text-text-3 mb-1">Courses</div>
            <div class="flex flex-wrap gap-2">
              <span v-for="c in r.courses" :key="c.id" class="badge">{{ courseLabel(c) }}</span>
            </div>
          </div>

          <div v-if="r.proofUrl" class="mt-3">
            <div class="text-xs text-text-3 mb-1">Proof</div>
            <a class="link" :href="r.proofUrl" target="_blank" rel="noreferrer">Open proof link</a>
          </div>

          <div v-if="status === 'pending'" class="mt-4 flex flex-col sm:flex-row gap-2">
            <AppButton class="sm:w-auto" @click="approve(r.id, r.courses.map(x => x.id))">Approve</AppButton>
            <button class="btn btn-ghost sm:w-auto" @click="deny(r.id)">Deny</button>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
