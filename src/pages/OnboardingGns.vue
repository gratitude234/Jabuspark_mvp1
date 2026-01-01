<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../utils/api'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import AppSelect from '../components/AppSelect.vue'

const router = useRouter()
const auth = useAuthStore()

const busy = ref(false)
const loadingCourses = ref(false)
const error = ref('')
const ok = ref('')

const level = ref(auth.user?.profile?.level || 200)
const courses = ref([])
const selectedIds = ref([])

const levelOptions = [
  { value: 100, label: '100 Level' },
  { value: 200, label: '200 Level' },
  { value: 300, label: '300 Level' },
  { value: 400, label: '400 Level' },
  { value: 500, label: '500 Level' },
  { value: 600, label: '600 Level' },
]

const canSave = computed(() => !busy.value && Number(level.value) > 0 && selectedIds.value.length > 0)

function toggle(id) {
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}

async function fetchGnsCourses() {
  error.value = ''
  ok.value = ''
  loadingCourses.value = true
  try {
    const qs = new URLSearchParams({ level: String(Number(level.value) || 0) })
    const res = await apiFetch(`/catalog/gns-courses?${qs.toString()}`)
    courses.value = res?.data?.courses || []

    // Default: select all GST/GNS courses for the chosen level
    selectedIds.value = (courses.value || []).map(c => c.id)
  } catch (e) {
    error.value = e?.message || 'Failed to load GNS courses.'
    courses.value = []
    selectedIds.value = []
  } finally {
    loadingCourses.value = false
  }
}

async function save() {
  if (!canSave.value) return
  busy.value = true
  error.value = ''
  ok.value = ''
  try {
    await auth.updateProfile({
      level: Number(level.value),
      courseIds: selectedIds.value,
    })
    ok.value = 'Saved! You can start practising now.'
    router.replace('/practice')
  } catch (e) {
    error.value = e?.message || 'Failed to save setup.'
  } finally {
    busy.value = false
  }
}

watch(level, async () => {
  await fetchGnsCourses()
})

onMounted(async () => {
  await fetchGnsCourses()
})
</script>

<template>
  <div class="page">
    <AppCard class="max-w-3xl mx-auto">
      <div class="row">
        <div>
          <div class="kicker">Onboarding</div>
          <div class="h1 mt-1">GNS Exam Prep (GST)</div>
          <p class="sub mt-2 max-w-[62ch]">
            Choose your level and we’ll add the GST/GNS courses available for that level. No department needed.
          </p>
        </div>
        <RouterLink to="/onboarding" class="btn btn-ghost">Back</RouterLink>
      </div>

      <div class="divider my-5" />

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="gnsLevel">Your level</label>
          <AppSelect id="gnsLevel" v-model="level" :options="levelOptions" placeholder="Select level…" />
          <p class="help">We’ll show GST/GNS courses for this level.</p>
        </div>
        <div class="card card-pad bg-surface/60 border border-border/70">
          <div class="text-xs text-text-3">Selected courses</div>
          <div class="text-2xl font-extrabold mt-1">{{ selectedIds.length }}</div>
          <div class="text-xs text-text-3 mt-1">You can uncheck any course you don’t need.</div>
        </div>
      </div>

      <div class="divider my-5" />

      <div>
        <div class="h2">GST/GNS courses</div>
        <p class="sub mt-1">Tap to toggle.</p>

        <p v-if="loadingCourses" class="sub mt-3">Loading courses…</p>
        <div v-else-if="courses.length === 0" class="alert alert-warn mt-4" role="alert">
          No GST/GNS courses found for this level yet.
          <div class="mt-2 text-xs opacity-80">Tip: you can still request your department content from onboarding.</div>
        </div>

        <div v-else class="grid gap-2 sm:grid-cols-2 mt-3">
          <button
            v-for="c in courses"
            :key="c.id"
            type="button"
            class="card card-press card-pad text-left"
            :class="selectedIds.includes(c.id) ? 'ring-2 ring-accent/50' : ''"
            :disabled="busy"
            @click="toggle(c.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">{{ c.code }} — {{ c.title }}</div>
                <div class="text-xs text-text-3 mt-1">Level {{ c.level }}</div>
              </div>
              <span class="badge" :class="selectedIds.includes(c.id) ? 'bg-accent/15 border-accent/30 text-text' : ''">
                {{ selectedIds.includes(c.id) ? '✓' : '+' }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <div v-if="ok" class="alert alert-ok mt-4" role="status">{{ ok }}</div>
      <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>

      <div class="mt-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div class="text-xs text-text-3">
          This saves your level + selected GST/GNS courses to your profile.
        </div>
        <AppButton class="w-full sm:w-auto" :disabled="!canSave" @click="save">
          <span v-if="!busy">Finish setup</span>
          <span v-else">Saving…</span>
        </AppButton>
      </div>
    </AppCard>
  </div>
</template>
