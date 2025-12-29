<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppInput from '../components/AppInput.vue'

const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()
const data = useDataStore()

const profile = computed(() => auth.user?.profile || {})
const selectedCourseId = ref(profile.value.courseIds?.[0] || '')
const count = ref(40)
const durationMins = ref(60)
const loading = ref(false)
const error = ref('')

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)
const courseOptions = computed(() => myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level}) — ${c.title}` })))

onMounted(async () => {
  await catalog.fetchCourses()
  if (!selectedCourseId.value && courseOptions.value.length) selectedCourseId.value = courseOptions.value[0].value
})

async function start() {
  if (!selectedCourseId.value) return
  loading.value = true
  error.value = ''
  try {
    const out = await data.startExam({
      courseId: selectedCourseId.value,
      count: Number(count.value || 40),
      durationMins: Number(durationMins.value || 60)
    })
    const id = out?.exam?.id
    if (id) router.push(`/exam/${id}`)
  } catch (e) {
    error.value = e?.message || 'Failed to start exam'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="h1">Exam Mode</div>
      <p class="sub mt-1">Timed CBT simulation — great for revision weeks and real exam confidence.</p>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="course">Course</label>
          <AppSelect id="course" v-model="selectedCourseId" :options="courseOptions" placeholder="Select course" />
          <p class="help">Uses questions from all banks under this course.</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="count">Questions</label>
            <AppInput id="count" v-model="count" type="number" min="5" max="120" />
          </div>
          <div>
            <label class="label" for="mins">Duration (mins)</label>
            <AppInput id="mins" v-model="durationMins" type="number" min="5" max="240" />
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-warn mt-4" role="alert">{{ error }}</div>

      <div class="mt-4 flex flex-col sm:flex-row gap-2">
        <button class="btn btn-primary" :disabled="!selectedCourseId || loading" @click="start">
          <span v-if="!loading">Start exam</span>
          <span v-else>Starting…</span>
        </button>
        <RouterLink to="/leaderboard" class="btn btn-ghost">View leaderboard</RouterLink>
      </div>
    </AppCard>
  </div>
</template>
