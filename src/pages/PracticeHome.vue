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
import { bankMeta } from '../utils/bankKind'
import { useRememberedCourseId } from '../composables/useRememberedCourseId'

const auth = useAuthStore()
const router = useRouter()
const catalog = useCatalogStore()
const content = useContentStore()
const data = useDataStore()
const ai = useAiStore()

const profile = computed(() => auth.user?.profile || {})
const progress = computed(() => data.progress || {})

const query = ref('')

const aiTopic = ref('')
const aiDifficulty = ref('mixed')
const aiCount = ref(8)
const aiError = ref('')

const duelBusy = ref({})

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)
const courseOptions = computed(() =>
  myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` }))
)

// UX: remember last selected course instead of defaulting to the first one.
const selectedCourseId = useRememberedCourseId('lastCourseId.practice', {
  getAllowedIds: () => myCourses.value.map(c => c.id),
  defaultValue: null, // All my courses
})

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
    const hay = [b.title, bankMeta(b).label].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
})

const bankLabel = (b) => bankMeta(b).label

// ✅ Improvement: show per-bank progress + accuracy (uses cached bankStats from the API)
function bankProgress(b) {
  const stats = data.answers?.[b?.id] || { answeredIds: [], correctIds: [] }
  const answered = Array.isArray(stats.answeredIds) ? stats.answeredIds.length : 0
  const correct = Array.isArray(stats.correctIds) ? stats.correctIds.length : 0
  const total = Number(b?.questionCount || 0)
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0
  const completion = total ? Math.round((answered / total) * 100) : 0
  return { answered, correct, total, accuracy, completion }
}

function bankProgressLabel(b) {
  const p = bankProgress(b)
  if (!p.answered) return 'Not started'
  const total = p.total || Number(b?.questionCount || 0)
  return `${p.answered}/${total} answered • ${p.accuracy}%`
}

const goalPct = computed(() => {
  const goal = Number(progress.value?.dailyGoal || 10)
  const done = Number(progress.value?.todayAnswered || 0)
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
    // handled globally
  } finally {
    duelBusy.value = { ...duelBusy.value, [bankId]: false }
  }
}
</script>

<template>
  <!-- pb-28 prevents bottom nav overlap on phones -->
  <div class="page pb-28 space-y-3">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Practice</div>
          <p class="sub mt-1">Quick drills to boost recall and exam confidence.</p>

          <!-- Stats: comfortable on mobile -->
          <div class="mt-4 grid grid-cols-3 gap-2">
            <StatPill label="Streak" :value="progress?.streak ?? 0" />
            <StatPill label="Accuracy" :value="(progress?.accuracy ?? 0) + '%'" />
            <StatPill label="Answered" :value="progress?.totalAnswered ?? 0" />
          </div>

          <!-- Today card -->
          <div class="mt-4 card card-pad">
            <div class="flex items-center justify-between text-sm font-semibold">
              <span>Today</span>
              <span class="text-text-2">Level {{ progress?.level ?? 0 }} • {{ progress?.xp ?? 0 }} XP</span>
            </div>

            <div class="mt-2 flex items-center justify-between text-xs text-text-3">
              <span>Goal</span>
              <span>{{ progress?.todayAnswered ?? 0 }} / {{ progress?.dailyGoal ?? 10 }}</span>
            </div>

            <div class="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div class="h-full bg-accent transition-all duration-200" :style="{ width: goalPct + '%' }" />
            </div>

            <!-- Goals: horizontal scroll on mobile so buttons don't wrap weirdly -->
            <div class="mt-3 -mx-3 px-3 overflow-x-auto">
              <div class="btn-row">
                <button type="button" class="btn btn-ghost btn-sm h-11 whitespace-nowrap" @click="data.setDailyGoal(10)">Goal 10</button>
                <button type="button" class="btn btn-ghost btn-sm h-11 whitespace-nowrap" @click="data.setDailyGoal(20)">Goal 20</button>
                <button type="button" class="btn btn-ghost btn-sm h-11 whitespace-nowrap" @click="data.setDailyGoal(50)">Goal 50</button>
              </div>
            </div>
          </div>

          <!-- Quick links: scroll on mobile (prevents cramped multi-line buttons) -->
          <div class="mt-3 -mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0">
            <div class="btn-row">
              <button type="button" class="btn btn-ghost btn-sm h-11 whitespace-nowrap" @click="router.push('/practice/review')">
                Smart Review
                <span v-if="progress?.dueReviews" class="badge ml-2">{{ progress.dueReviews }}</span>
              </button>
              <button type="button" class="btn btn-ghost btn-sm h-11 whitespace-nowrap" @click="router.push('/progress')">Progress</button>
              <button type="button" class="btn btn-ghost btn-sm h-11 whitespace-nowrap" @click="router.push('/exam')">Exam Mode</button>
              <button type="button" class="btn btn-ghost btn-sm h-11 whitespace-nowrap" @click="router.push('/leaderboard')">Leaderboard</button>
            </div>
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
          <AppInput id="banksearch" v-model="query" placeholder="Search banks…" />
        </div>
      </div>

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">{{ content.error }}</div>
    </AppCard>

    <!-- AI Generator -->
    <AppCard>
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

      <div class="mt-3 grid gap-2 sm:flex sm:items-end sm:gap-3">
        <div class="w-full sm:w-[220px]">
          <label class="label" for="aiDifficulty">Difficulty</label>
          <select id="aiDifficulty" v-model="aiDifficulty" class="input h-11">
            <option value="mixed">Mixed</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <button
          class="btn btn-primary w-full sm:w-auto h-11"
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

    <!-- Banks -->
    <AppCard v-if="content.loading.banks">
      <div class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <AppCard v-else-if="banks.length === 0">
      <div class="h2">No banks found</div>
      <p class="sub mt-1">Try selecting a different course, or check back later as new banks are added.</p>
    </AppCard>

    <div v-else class="grid gap-3">
      <div class="flex items-end justify-between">
        <div class="h2">Available banks</div>
        <div class="text-xs text-text-3">
          Showing <span class="font-semibold text-text">{{ banks.length }}</span>
        </div>
      </div>

      <div v-for="b in banks" :key="b.id" class="card card-pad">
        <div class="flex flex-col gap-3">
          <div class="min-w-0">
            <div class="text-base font-extrabold leading-snug break-words line-clamp-2">
              {{ b.title }}
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="chip">{{ b.questionCount }} questions</span>
              <span class="chip">{{ bankLabel(b) }}</span>
              <span class="chip" :class="bankProgress(b).answered ? '' : 'opacity-70'">
                {{ bankProgressLabel(b) }}
                <span v-if="bankProgress(b).answered" class="ml-1">• {{ bankProgress(b).completion }}% done</span>
              </span>
            </div>
          </div>

          <!-- Actions: 2-column on mobile, inline on desktop -->
          <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <RouterLink
              :to="`/practice/${b.id}`"
              class="btn btn-primary btn-sm w-full sm:w-auto h-11 justify-center"
            >
              Start practice
            </RouterLink>

            <button
              type="button"
              class="btn btn-ghost btn-sm w-full sm:w-auto h-11 justify-center"
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

<style scoped>
/* Simple horizontal scroll rows used for button groups */
.btn-row {
  display: flex;
  gap: 0.5rem;
  width: max-content;
  padding-bottom: 0.25rem; /* breathing room above scrollbar */
}

/* Chips for bank meta */
.chip {
  padding: 0.35rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  line-height: 1rem;
  background: rgba(0, 0, 0, 0.06);
}
</style>
