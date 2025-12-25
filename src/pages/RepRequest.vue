<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { apiFetch } from '../utils/api'

import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()

const request = ref(null)
const loading = ref(false)
const error = ref('')
const ok = ref('')

const level = ref(200)
const reason = ref('')
const proofUrl = ref('')
const selectedCourseIds = ref([])

const levelOptions = [
  { value: 100, label: '100 Level' },
  { value: 200, label: '200 Level' },
  { value: 300, label: '300 Level' },
  { value: 400, label: '400 Level' },
  { value: 500, label: '500 Level' },
  { value: 600, label: '600 Level' },
]

const courseOptions = computed(() => (catalog.courses || []).map(c => ({
  id: c.id,
  label: `${c.code} — ${c.title} (${c.level})`
})))

function toggleCourse(id) {
  const i = selectedCourseIds.value.indexOf(id)
  if (i >= 0) selectedCourseIds.value.splice(i, 1)
  else selectedCourseIds.value.push(id)
}

async function loadMyRequest() {
  try {
    const res = await apiFetch('/rep/my')
    request.value = res?.data?.request || null
  } catch {
    request.value = null
  }
}

async function submit() {
  error.value = ''
  ok.value = ''
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
      }
    })
    ok.value = 'Request submitted. You will see the status update once an admin reviews it.'
    await loadMyRequest()
  } catch (e) {
    error.value = e?.message || 'Failed to submit request.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await catalog.fetchCourses({})
  await loadMyRequest()
  // If already approved, just send them to uploads
  if (auth.user?.role === 'course_rep' || auth.user?.role === 'admin') {
    router.replace('/uploads')
  }
})

const statusBadgeClass = computed(() => {
  const st = request.value?.status
  if (st === 'approved') return 'badge bg-accent/15 border-accent/30 text-text'
  if (st === 'denied') return 'badge bg-red-500/10 border-red-500/25 text-red-200'
  return 'badge'
})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="row">
        <div>
          <div class="h1">Course Rep Access</div>
          <p class="sub mt-1">Request upload permission for specific courses. An admin must approve you.</p>
        </div>
        <RouterLink to="/profile" class="btn btn-ghost">Back</RouterLink>
      </div>

      <div v-if="request" class="mt-4 card card-pad">
        <div class="row">
          <div>
            <div class="text-sm font-extrabold">Your latest request</div>
            <div class="text-xs text-text-3 mt-1">Submitted: {{ request.requestedAt }}</div>
          </div>
          <span :class="statusBadgeClass">{{ request.status }}</span>
        </div>

        <div class="mt-3 text-sm text-text-2">{{ request.reason }}</div>
        <div v-if="request.adminNote" class="alert alert-danger mt-3" role="note">
          Admin note: {{ request.adminNote }}
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="cid in request.courseIds" :key="cid" class="badge">{{ cid }}</span>
        </div>
      </div>

      <div v-if="request?.status === 'pending'" class="alert alert-ok mt-4" role="status">
        Your request is pending review.
      </div>
      <div v-if="ok" class="alert alert-ok mt-4" role="status">{{ ok }}</div>
      <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
    </AppCard>

    <AppCard>
      <div class="h2">Submit a new request</div>
      <p class="sub mt-1">Only submit if you don’t already have a pending request.</p>

      <div class="divider my-4" />

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="repLevel">Your level</label>
          <AppSelect id="repLevel" v-model="level" :options="levelOptions" placeholder="Select level…" />
        </div>
        <div>
          <label class="label" for="proof">Proof (optional link)</label>
          <input id="proof" v-model="proofUrl" class="input" placeholder="WhatsApp group link / screenshot link" />
          <p class="help">You can paste a link that supports your request.</p>
        </div>
      </div>

      <div class="mt-4">
        <label class="label" for="reason">Why should you be approved?</label>
        <textarea id="reason" v-model="reason" class="input min-h-[110px]" placeholder="e.g., I'm the official class rep for CSC201 and I manage past questions." />
      </div>

      <div class="divider my-6" />

      <div class="row">
        <div>
          <div class="h2">Courses you want to upload for</div>
          <p class="sub mt-1">Select one or more courses.</p>
        </div>
        <span class="badge">{{ selectedCourseIds.length }} selected</span>
      </div>

      <div class="mt-3">
        <p v-if="catalog.loading.courses" class="sub">Loading courses…</p>
        <div v-else class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="c in courseOptions"
            :key="c.id"
            type="button"
            class="card card-press card-pad text-left"
            :class="selectedCourseIds.includes(c.id) ? 'ring-2 ring-accent/50' : ''"
            @click="toggleCourse(c.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">{{ c.label }}</div>
                <div class="text-xs text-text-3 mt-1">{{ selectedCourseIds.includes(c.id) ? 'Selected' : 'Tap to select' }}</div>
              </div>
              <span class="badge" :class="selectedCourseIds.includes(c.id) ? 'bg-accent/15 border-accent/30 text-text' : ''">
                {{ selectedCourseIds.includes(c.id) ? '✓' : '+' }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <div class="mt-5">
        <AppButton :disabled="loading || (request?.status === 'pending')" @click="submit">
          <span v-if="!loading">Submit request</span>
          <span v-else>Submitting…</span>
        </AppButton>
      </div>
    </AppCard>
  </div>
</template>
