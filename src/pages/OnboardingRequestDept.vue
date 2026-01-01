<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { apiFetch } from '../utils/api'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'
import AppInput from '../components/AppInput.vue'

const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()

const busy = ref(false)
const error = ref('')
const ok = ref('')

const facultyId = ref(auth.user?.profile?.facultyId || null)
const departmentId = ref(auth.user?.profile?.departmentId || null)
const departmentName = ref('')
const level = ref(auth.user?.profile?.level || 200)
const courseCodes = ref('')
const phone = ref('')

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

watch(facultyId, async (next) => {
  departmentId.value = null
  if (!next) return
  await catalog.fetchDepartments({ facultyId: next })
})

async function submit() {
  error.value = ''
  ok.value = ''

  if (!departmentId.value && !departmentName.value.trim()) {
    error.value = 'Pick a department or type the department name.'
    return
  }

  busy.value = true
  try {
    await apiFetch('/onboarding/department-request', {
      method: 'POST',
      body: {
        facultyId: facultyId.value || '',
        departmentId: departmentId.value || '',
        departmentName: departmentName.value.trim(),
        level: Number(level.value) || 0,
        courseCodes: courseCodes.value.trim(),
        phone: phone.value.trim(),
      }
    })

    ok.value = 'Request submitted! We’ll prioritise your department content.'
  } catch (e) {
    error.value = e?.message || 'Failed to submit request.'
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await catalog.bootstrap()
  if (facultyId.value) await catalog.fetchDepartments({ facultyId: facultyId.value })
})
</script>

<template>
  <div class="page">
    <AppCard class="max-w-3xl mx-auto">
      <div class="row">
        <div>
          <div class="kicker">Onboarding</div>
          <div class="h1 mt-1">Request your department</div>
          <p class="sub mt-2 max-w-[62ch]">
            Since onboarding is happening department-by-department, drop your department and key courses.
            This helps us recruit admins/course reps and upload the right materials + past questions.
          </p>
        </div>
        <RouterLink to="/onboarding" class="btn btn-ghost">Back</RouterLink>
      </div>

      <div class="divider my-5" />

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="faculty">Faculty (optional)</label>
          <AppSelect id="faculty" v-model="facultyId" :options="facultyOptions" placeholder="Select faculty…" />
        </div>
        <div>
          <label class="label" for="level">Level</label>
          <AppSelect id="level" v-model="level" :options="levelOptions" placeholder="Select level…" />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 mt-4">
        <div>
          <label class="label" for="dept">Department (pick if available)</label>
          <AppSelect id="dept" v-model="departmentId" :options="departmentOptions" placeholder="Select department…" />
          <p class="help">If you can’t find it, type it below.</p>
        </div>
        <div>
          <label class="label" for="deptName">Department name (optional)</label>
          <AppInput id="deptName" v-model="departmentName" placeholder="e.g., Computer Science" />
        </div>
      </div>

      <div class="mt-4">
        <label class="label" for="courses">Important course codes (optional)</label>
        <textarea
          id="courses"
          v-model="courseCodes"
          class="input min-h-[110px]"
          placeholder="e.g., GST 211, GST 212, CSC 201, CSC 203…"
        />
        <p class="help">Separate with commas or new lines.</p>
      </div>

      <div class="mt-4">
        <label class="label" for="phone">Phone / WhatsApp (optional)</label>
        <AppInput id="phone" v-model="phone" placeholder="e.g., 0803xxxxxxx" />
      </div>

      <div v-if="ok" class="alert alert-ok mt-4" role="status">{{ ok }}</div>
      <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>

      <div class="mt-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div class="text-xs text-text-3">
          After submitting, you can still start with GNS Exam Prep.
        </div>
        <div class="flex gap-2">
          <AppButton :disabled="busy" @click="submit">
            <span v-if="!busy">Submit request</span>
            <span v-else>Submitting…</span>
          </AppButton>
          <RouterLink to="/onboarding/gns" class="btn btn-ghost">Start GNS now</RouterLink>
        </div>
      </div>
    </AppCard>
  </div>
</template>
