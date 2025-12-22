<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()

const facultyId = ref(auth.user?.profile?.facultyId || null)
const departmentId = ref(auth.user?.profile?.departmentId || null)
const level = ref(auth.user?.profile?.level || 200)
const pickedCourseIds = ref([...(auth.user?.profile?.courseIds || [])])

const busy = ref(false)
const error = ref('')

const levelOptions = [
  { value: 100, label: '100 Level' },
  { value: 200, label: '200 Level' },
  { value: 300, label: '300 Level' },
  { value: 400, label: '400 Level' },
  { value: 500, label: '500 Level' },
  { value: 600, label: '600 Level' },
]

const facultyOptions = computed(() =>
  (catalog.faculties || []).map(f => ({ value: f.id, label: f.name }))
)

const departmentOptions = computed(() =>
  (catalog.departments || []).map(d => ({ value: d.id, label: d.name }))
)

const courseOptions = computed(() =>
  (catalog.courses || []).map(c => ({
    id: c.id,
    label: `${c.code} — ${c.title} (${c.level})`
  }))
)

function toggleCourse(id) {
  const i = pickedCourseIds.value.indexOf(id)
  if (i >= 0) pickedCourseIds.value.splice(i, 1)
  else pickedCourseIds.value.push(id)
}

watch(facultyId, async (next) => {
  departmentId.value = null
  pickedCourseIds.value = []
  if (!next) return
  await catalog.fetchDepartments({ facultyId: next })
})

watch([departmentId, level], async ([dept, lvl]) => {
  pickedCourseIds.value = []
  if (!dept) return
  await catalog.fetchCourses({ departmentId: dept, level: Number(lvl) || 0 })
})

onMounted(async () => {
  error.value = ''
  await catalog.bootstrap()
  if (facultyId.value) await catalog.fetchDepartments({ facultyId: facultyId.value })
  if (departmentId.value) await catalog.fetchCourses({ departmentId: departmentId.value, level: Number(level.value) || 0 })
})

async function save({ skipCourses = false } = {}) {
  error.value = ''
  if (!facultyId.value) return (error.value = 'Choose a faculty to continue.')
  if (!departmentId.value) return (error.value = 'Choose a department to continue.')
  if (!level.value) return (error.value = 'Choose your level to continue.')

  const courseIds = skipCourses ? [] : pickedCourseIds.value

  busy.value = true
  try {
    await auth.updateProfile({
      facultyId: facultyId.value,
      departmentId: departmentId.value,
      level: Number(level.value),
      courseIds
    })
    router.push('/dashboard')
  } catch (e) {
    error.value = e?.message || 'Failed to save. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppCard class="max-w-3xl mx-auto">
      <div class="h1">Set up your study profile (1 minute)</div>
      <p class="sub mt-2">This helps JabuSpark show the right materials and practice banks.</p>

      <div class="grid gap-4 mt-6 sm:grid-cols-3">
        <div class="sm:col-span-1">
          <label class="label">Faculty</label>
          <AppSelect v-model="facultyId" :options="facultyOptions" placeholder="Select faculty…" />
          <p v-if="catalog.loading.faculties" class="help">Loading…</p>
        </div>

        <div class="sm:col-span-1">
          <label class="label">Department</label>
          <AppSelect v-model="departmentId" :options="departmentOptions" placeholder="Select department…" />
          <p v-if="catalog.loading.departments" class="help">Loading…</p>
        </div>

        <div class="sm:col-span-1">
          <label class="label">Level</label>
          <AppSelect v-model="level" :options="levelOptions" placeholder="Select level…" />
        </div>
      </div>

      <div class="divider my-6"></div>

      <div class="h2">Courses (optional)</div>
      <p class="sub mt-1">Choose your courses now — or skip and add them later in Profile.</p>

      <div class="mt-3">
        <p v-if="catalog.loading.courses" class="sub">Loading courses…</p>
        <div v-else-if="courseOptions.length === 0" class="alert alert-ok" role="status">
          Select a department (and level) to load courses.
        </div>

        <div v-else class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="c in courseOptions"
            :key="c.id"
            class="card card-press card-pad text-left"
            :class="pickedCourseIds.includes(c.id) ? 'ring-2 ring-accent/50' : ''"
            type="button"
            @click="toggleCourse(c.id)"
          >
            <div class="text-sm font-semibold">{{ c.label }}</div>
            <div class="text-xs text-text-3 mt-1">
              {{ pickedCourseIds.includes(c.id) ? 'Selected' : 'Tap to select' }}
            </div>
          </button>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>

      <div class="mt-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div class="text-xs text-text-3">
          You can change this later in your profile.
        </div>

        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            class="btn btn-ghost w-full sm:w-auto"
            :disabled="busy"
            @click="save({ skipCourses: true })"
          >
            Pick courses later
          </button>

          <AppButton class="w-full sm:w-auto" :disabled="busy" @click="save()">
            <span v-if="!busy">Continue</span>
            <span v-else>Saving…</span>
          </AppButton>
        </div>
      </div>
    </AppCard>
  </div>
</template>
