<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '../stores/data'
import { useCatalogStore } from '../stores/catalog'
import AppCard from '../components/AppCard.vue'
import { toast } from '../utils/toast'

const route = useRoute()
const router = useRouter()
const data = useDataStore()
const catalog = useCatalogStore()

const groupId = computed(() => String(route.params.groupId || ''))

const loading = ref(false)
const error = ref('')

const title = ref('')
const courseId = ref('')
const count = ref(20)
const durationMins = ref(20)

const courses = computed(() => catalog.courses || [])

onMounted(async () => {
  try {
    if (!catalog.courses.length) await catalog.fetchCourses()
    // preload group info so we can check role
    if (!data.groups.current || String(data.groups.current.id) !== String(groupId.value)) {
      await data.getGroup(groupId.value)
    }
  } catch (e) {
    // ignore
  }
})

async function create() {
  if (!groupId.value) return
  const t = title.value.trim()
  if (t.length < 3) return toast('Title is too short.', 'warn')
  if (!courseId.value) return toast('Pick a course.', 'warn')

  loading.value = true
  error.value = ''
  try {
    await data.createGroupChallenge({
      groupId: groupId.value,
      title: t,
      courseId: courseId.value,
      count: Math.max(5, Math.min(100, Number(count.value) || 20)),
      durationMins: Math.max(5, Math.min(180, Number(durationMins.value) || 20)),
    })
    router.replace(`/groups/${groupId.value}`)
  } catch (e) {
    error.value = e?.message || 'Failed to create challenge'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="row">
        <div>
          <div class="h1">New Challenge</div>
          <p class="sub mt-1">Create a timed challenge for your group.</p>
        </div>
        <RouterLink :to="`/groups/${groupId}`" class="btn btn-ghost">Back</RouterLink>
      </div>

      <div v-if="error" class="alert alert-warn mt-4" role="alert">{{ error }}</div>

      <div class="mt-4 grid gap-3">
        <div>
          <div class="text-sm font-extrabold">Title</div>
          <input v-model="title" class="input mt-2 w-full" placeholder="e.g. Week 3 Revision" />
        </div>

        <div>
          <div class="text-sm font-extrabold">Course</div>
          <select v-model="courseId" class="select mt-2 w-full">
            <option value="" disabled>Select a course</option>
            <option v-for="c in courses" :key="c.id" :value="String(c.id)">
              {{ c.code }} — {{ c.title }}
            </option>
          </select>
        </div>

        <div class="grid sm:grid-cols-2 gap-3">
          <div>
            <div class="text-sm font-extrabold">Questions</div>
            <input v-model.number="count" type="number" min="5" max="100" class="input mt-2 w-full" />
            <div class="text-xs text-text-3 mt-1">5–100 questions</div>
          </div>
          <div>
            <div class="text-sm font-extrabold">Duration (mins)</div>
            <input v-model.number="durationMins" type="number" min="5" max="180" class="input mt-2 w-full" />
            <div class="text-xs text-text-3 mt-1">5–180 minutes</div>
          </div>
        </div>

        <button class="btn btn-primary btn-lg" :disabled="loading" @click="create">
          {{ loading ? 'Creating...' : 'Create challenge' }}
        </button>
      </div>
    </AppCard>
  </div>
</template>
