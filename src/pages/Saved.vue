<script setup>
import { computed, onMounted, ref } from 'vue'
import { useDataStore } from '../stores/data'
import { useContentStore } from '../stores/content'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import PdfModal from '../components/PdfModal.vue'

const data = useDataStore()
const content = useContentStore()

const tab = ref('pastQuestions') // pastQuestions | materials | questions
const openItem = ref(null)

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

const savedQuestionsCount = computed(() => (saved.value.questions || []).length)

async function toggleSaved(kind, id) {
  await data.toggleSave(kind, id)
}

const tabCounts = computed(() => ({
  pastQuestions: savedPast.value.length,
  materials: savedMaterials.value.length,
  questions: savedQuestionsCount.value
}))
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="h1">Saved</div>
          <p class="sub mt-1">Everything you bookmarked in one place.</p>
        </div>
        <RouterLink class="btn btn-ghost" to="/practice">Practice</RouterLink>
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <button type="button" class="btn" :class="tab==='pastQuestions' ? 'btn-primary' : 'btn-ghost'" @click="tab='pastQuestions'">
          Past Q ({{ tabCounts.pastQuestions }})
        </button>
        <button type="button" class="btn" :class="tab==='materials' ? 'btn-primary' : 'btn-ghost'" @click="tab='materials'">
          Materials ({{ tabCounts.materials }})
        </button>
        <button type="button" class="btn" :class="tab==='questions' ? 'btn-primary' : 'btn-ghost'" @click="tab='questions'">
          Questions ({{ tabCounts.questions }})
        </button>
      </div>

      <div v-if="data.error" class="alert alert-warn mt-4" role="alert">{{ data.error }}</div>
    </AppCard>

    <!-- Past Questions -->
    <div v-if="tab==='pastQuestions'">
      <AppCard v-if="savedPast.length === 0">
        <div class="h2">No saved past questions</div>
        <p class="sub mt-1">Save past questions to quickly find them here.</p>
        <div class="mt-3">
          <RouterLink class="btn btn-ghost" to="/past-questions">Browse past questions</RouterLink>
        </div>
      </AppCard>

      <div v-else class="grid gap-3">
        <div v-for="pq in savedPast" :key="pq.id" class="card card-pad">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div class="min-w-0">
              <div class="text-base sm:text-lg font-extrabold truncate">{{ pq.title }}</div>
              <div class="text-sm text-text-2 mt-1">
                {{ pq.session }} <span class="text-text-3">•</span> {{ pq.semester }}
              </div>
            </div>

            <div class="flex flex-wrap gap-2 sm:justify-end">
              <AppButton variant="ghost" size="sm" @click="toggleSaved('pastQuestions', pq.id)">Remove</AppButton>
              <AppButton variant="ghost" size="sm" @click="openItem = pq">Preview</AppButton>
              <a class="btn btn-ghost btn-sm" :href="pq.fileUrl" target="_blank" rel="noreferrer">Open</a>
            </div>
          </div>
        </div>
      </div>

      <PdfModal
        :open="!!openItem"
        :title="openItem?.title || 'Saved item'"
        :url="openItem?.fileUrl || ''"
        @close="openItem = null"
      />
    </div>

    <!-- Materials -->
    <div v-else-if="tab==='materials'">
      <AppCard v-if="savedMaterials.length === 0">
        <div class="h2">No saved materials</div>
        <p class="sub mt-1">Save lecture notes and PDFs to quickly find them here.</p>
        <div class="mt-3">
          <RouterLink class="btn btn-ghost" to="/materials">Browse materials</RouterLink>
        </div>
      </AppCard>

      <div v-else class="grid gap-3">
        <div v-for="m in savedMaterials" :key="m.id" class="card card-pad">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div class="min-w-0">
              <div class="text-base sm:text-lg font-extrabold truncate">{{ m.title }}</div>
              <div class="text-sm text-text-2 mt-1">
                <span v-if="m.type">{{ m.type }}</span>
              </div>
              <div v-if="m.tags?.length" class="mt-2 flex flex-wrap gap-2">
                <span v-for="t in m.tags" :key="t" class="badge">{{ t }}</span>
              </div>
            </div>

            <div class="flex flex-wrap gap-2 sm:justify-end">
              <AppButton variant="ghost" size="sm" @click="toggleSaved('materials', m.id)">Remove</AppButton>
              <AppButton variant="ghost" size="sm" @click="openItem = m">Preview</AppButton>
              <a class="btn btn-ghost btn-sm" :href="m.fileUrl" target="_blank" rel="noreferrer">Open</a>
            </div>
          </div>
        </div>
      </div>

      <PdfModal
        :open="!!openItem"
        :title="openItem?.title || 'Saved item'"
        :url="openItem?.fileUrl || ''"
        @close="openItem = null"
      />
    </div>

    <!-- Questions -->
    <div v-else>
      <AppCard>
        <div class="h2">Saved questions</div>
        <p class="sub mt-1">
          You have <strong>{{ savedQuestionsCount }}</strong> saved question(s).
        </p>
        <p class="help mt-2">
          Saved question IDs are stored, but question details live inside banks. To revisit them,
          open your practice banks and look for the “Saved” badge.
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <RouterLink to="/practice" class="btn btn-primary">Go to practice</RouterLink>
          <RouterLink to="/practice" class="btn btn-ghost">Browse banks</RouterLink>
        </div>
      </AppCard>
    </div>
  </div>
</template>
