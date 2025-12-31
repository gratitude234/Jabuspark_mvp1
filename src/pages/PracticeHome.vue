<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import { useAiStore } from '../stores/ai'
import AppCard from '../components/AppCard.vue'
import AppInput from '../components/AppInput.vue'
import AppSelect from '../components/AppSelect.vue'
import StatPill from '../components/StatPill.vue'

const auth = useAuthStore()
const router = useRouter()
const catalog = useCatalogStore()
const content = useContentStore()
const data = useDataStore()
const ai = useAiStore()

const profile = computed(() => auth.user?.profile || {})
const selectedCourseId = ref(profile.value.courseIds?.[0] || null)
const query = ref('')

const aiTopic = ref('')
const aiDifficulty = ref('mixed')
const aiCount = ref(8)
const aiError = ref('')

const duelBusy = ref({})

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)
const courseOptions = computed(() => myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` })))

watch(selectedCourseId, async (cid) => {
  await content.fetchBanks({ courseId: cid || '' })
})

onMounted(async () => {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
  await content.fetchBanks({ courseId: selectedCourseId.value || '' })
})

const banks = computed(() => {
  const list = content.banks || []
  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((b) => {
    const hay = [b.title, b.mode].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
})

const goalPct = computed(() => {
  const goal = Number(data.progress?.dailyGoal || 10)
  const done = Number(data.progress?.todayAnswered || 0)
  if (!goal) return 0
  return Math.max(0, Math.min(100, Math.round((done / goal) * 100)))
})

async function generateAiBank() {
  if (!selectedCourseId.value) return
  aiError.value = ''
  try {
    const out = await ai.generateBank({
      courseId: selectedCourseId.value,
      topic: aiTopic.value,
      difficulty: aiDifficulty.value,
      count: aiCount.value,
    })
    if (out?.bankId) {
      await content.fetchBanks({ courseId: selectedCourseId.value || '' })
      router.push(`/practice/${out.bankId}`)
    }
  } catch (e) {
    aiError.value = e?.message || 'Failed to generate AI bank'
  }
}

async function challengeFriend(bankId) {
  if (!bankId) return
  duelBusy.value = { ...duelBusy.value, [bankId]: true }
  try {
    const duel = await data.createDuel({ bankId })
    if (duel?.code) router.push(`/duel/${duel.code}`)
  } catch (e) {
    // data store already toasts on success; error handled by global fetch handler
  } finally {
    duelBusy.value = { ...duelBusy.value, [bankId]: false }
  }
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Practice</div>
          <p class="sub mt-1">Quick drills to boost recall and exam confidence.</p>

          <div class="mt-4 grid grid-cols-3 gap-2">
            <StatPill label="Streak" :value="data.progress.streak" />
            <StatPill label="Accuracy" :value="data.progress.accuracy + '%'" />
            <StatPill label="Answered" :value="data.progress.totalAnswered" />
          </div>

          <div class="mt-4 card card-pad">
            <div class="flex items-center justify-between text-sm font-semibold">
              <span>Today</span>
              <span class="text-text-2">Level {{ data.progress.level }} • {{ data.progress.xp }} XP</span>
            </div>
            <div class="mt-2 flex items-center justify-between text-xs text-text-3">
              <span>Goal</span>
              <span>{{ data.progress.todayAnswered }} / {{ data.progress.dailyGoal }}</span>
            </div>
            <div class="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div class="h-full bg-accent transition-all duration-200" :style="{ width: goalPct + '%' }" />
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(10)">Goal 10</button>
              <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(20)">Goal 20</button>
              <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(50)">Goal 50</button>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="router.push('/practice/review')"
            >
              Smart Review
              <span v-if="data.progress?.dueReviews" class="badge ml-2">{{ data.progress.dueReviews }}</span>
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="router.push('/progress')"
            >
              Progress
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="router.push('/exam')"
            >
              Exam Mode
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="router.push('/leaderboard')"
            >
              Leaderboard
            </button>
          </div>
        </div>

        <div class="w-full sm:w-[340px]">
          <label class="label" for="course">Course</label>
          <AppSelect
            id="course"
            v-model="selectedCourseId"
            :options="courseOptions"
            placeholder="All my courses"
          />
          <p class="help">Tip: choose a course to see focused banks.</p>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="banksearch">Search</label>
          <AppInput
            id="banksearch"
            v-model="query"
            placeholder="Search banks…"
          />
        </div>
      </div>

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">{{ content.error }}</div>
    </AppCard>

    <!-- AI Generator -->
    <AppCard class="mt-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="h2">AI quick quiz</div>
          <p class="sub mt-1">Generate a fresh MCQ bank for the selected course using Gemini.</p>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="sm:col-span-2">
          <label class="label" for="aiTopic">Topic (optional)</label>
          <AppInput id="aiTopic" v-model="aiTopic" placeholder="e.g., Embryology: gastrulation" />
        </div>
        <div>
          <label class="label" for="aiCount">Questions</label>
          <AppInput id="aiCount" v-model="aiCount" type="number" min="3" max="20" placeholder="8" />
        </div>
      </div>

      <div class="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <div class="w-full sm:w-[220px]">
          <label class="label" for="aiDifficulty">Difficulty</label>
          <select id="aiDifficulty" v-model="aiDifficulty" class="input">
            <option value="mixed">Mixed</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div class="flex-1" />

        <button
          class="btn btn-primary w-full sm:w-auto"
          :disabled="!selectedCourseId || ai.loading.generateBank"
          @click="generateAiBank"
        >
          <span v-if="!ai.loading.generateBank">Generate bank</span>
          <span v-else>Generating…</span>
        </button>
      </div>

      <div v-if="aiError" class="alert alert-warn mt-3" role="alert">{{ aiError }}</div>
      <p class="help mt-2">Tip: AI banks are saved like normal practice banks so you can revisit them later.</p>
    </AppCard>

    <AppCard v-if="content.loading.banks">
      <div class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <AppCard v-else-if="banks.length === 0">
      <div class="h2">No banks found</div>
      <p class="sub mt-1">
        Try selecting a different course, or check back later as new banks are added.
      </p>
    </AppCard>

    <div v-else class="grid gap-3">
      <div v-for="b in banks" :key="b.id" class="card card-pad">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-base font-extrabold truncate">{{ b.title }}</div>
            <div class="text-sm text-text-2 mt-1">
              {{ b.questionCount }} questions
              <span class="text-text-3">•</span>
              {{ b.mode }}
            </div>
          </div>

          <div class="flex flex-col items-end gap-2">
            <RouterLink :to="`/practice/${b.id}`" class="badge">Start</RouterLink>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="!!duelBusy[b.id]"
              @click="challengeFriend(b.id)"
            >
              {{ duelBusy[b.id] ? 'Creating…' : 'Challenge friend' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
