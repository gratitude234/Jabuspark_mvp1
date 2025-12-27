<script setup>
import { computed, onMounted, ref } from 'vue'
import { useDataStore } from '../stores/data'
import { useContentStore } from '../stores/content'
import AppCard from '../components/AppCard.vue'

const data = useDataStore()
const content = useContentStore()

const tab = ref('pastQuestions') // pastQuestions | materials | questions

onMounted(async () => {
  await data.fetchProgress()
  // load lists so saved ids can map to items
  await Promise.allSettled([
    content.fetchPastQuestions(),
    content.fetchMaterials(),
    content.fetchBanks(),
  ])
})

const saved = computed(() => data.progress.saved || { pastQuestions: [], materials: [], questions: [] })

const savedPast = computed(() => (content.pastQuestions || []).filter(pq => saved.value.pastQuestions.includes(pq.id)))
const savedMaterials = computed(() => (content.materials || []).filter(m => saved.value.materials.includes(m.id)))

// Questions are saved by id; bank items may not include question details here.
// Keep as count + guidance for now.
const savedQuestionsCount = computed(() => (saved.value.questions || []).length)
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="min-w-0">
          <div class="h1">Saved</div>
          <p class="sub mt-1">Your bookmarked past questions, materials, and questions.</p>
        </div>

        <div class="seg w-full sm:w-auto" role="tablist" aria-label="Saved tabs">
          <button
            class="seg-btn"
            :class="tab === 'pastQuestions' ? 'seg-btn--active' : 'seg-btn--inactive'"
            role="tab"
            :aria-selected="tab === 'pastQuestions'"
            type="button"
            @click="tab = 'pastQuestions'"
          >
            Past Q
            <span class="badge ml-1">{{ saved.pastQuestions.length }}</span>
          </button>

          <button
            class="seg-btn"
            :class="tab === 'materials' ? 'seg-btn--active' : 'seg-btn--inactive'"
            role="tab"
            :aria-selected="tab === 'materials'"
            type="button"
            @click="tab = 'materials'"
          >
            Materials
            <span class="badge ml-1">{{ saved.materials.length }}</span>
          </button>

          <button
            class="seg-btn"
            :class="tab === 'questions' ? 'seg-btn--active' : 'seg-btn--inactive'"
            role="tab"
            :aria-selected="tab === 'questions'"
            type="button"
            @click="tab = 'questions'"
          >
            Questions
            <span class="badge ml-1">{{ savedQuestionsCount }}</span>
          </button>
        </div>
      </div>

      <div v-if="data.loading.progress" class="mt-4 grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <AppCard v-if="tab === 'pastQuestions'">
      <div class="h2">Past questions</div>
      <p class="sub mt-1">Quick access to what you saved.</p>

      <div class="divider my-4" />

      <div v-if="savedPast.length === 0" class="alert alert-ok" role="status">
        Nothing saved yet. When you save a past question, it shows up here.
        <RouterLink to="/past-questions" class="underline text-accent font-semibold ml-1">Browse past questions</RouterLink>
      </div>

      <div v-else class="grid gap-2">
        <RouterLink
          v-for="pq in savedPast"
          :key="pq.id"
          to="/past-questions"
          class="card card-press card-pad"
        >
          <div class="text-sm font-extrabold truncate">{{ pq.title }}</div>
          <div class="text-xs text-text-3 mt-1">{{ pq.session }} • {{ pq.semester }}</div>
        </RouterLink>
      </div>
    </AppCard>

    <AppCard v-else-if="tab === 'materials'">
      <div class="h2">Materials</div>
      <p class="sub mt-1">Your saved PDFs and notes.</p>

      <div class="divider my-4" />

      <div v-if="savedMaterials.length === 0" class="alert alert-ok" role="status">
        No materials saved yet.
        <RouterLink to="/materials" class="underline text-accent font-semibold ml-1">Browse materials</RouterLink>
      </div>

      <div v-else class="grid gap-2">
        <RouterLink
          v-for="m in savedMaterials"
          :key="m.id"
          to="/materials"
          class="card card-press card-pad"
        >
          <div class="text-sm font-extrabold truncate">{{ m.title }}</div>
          <div class="text-xs text-text-3 mt-1">{{ (m.tags || []).slice(0, 3).join(', ') }}</div>
        </RouterLink>
      </div>
    </AppCard>

    <AppCard v-else>
      <div class="h2">Saved questions</div>
      <p class="sub mt-1">
        Saved questions are tracked by ID. Open a bank to continue practising and review explanations.
      </p>

      <div class="divider my-4" />

      <div class="alert alert-ok" role="status">
        You have <span class="font-semibold">{{ savedQuestionsCount }}</span> saved question(s).
        <RouterLink to="/practice" class="underline text-accent font-semibold ml-1">Go to practice banks</RouterLink>
      </div>
    </AppCard>
  </div>
</template>
