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

const auth = useAuthStore()
const router = useRouter()
const catalog = useCatalogStore()
const content = useContentStore()
const data = useDataStore()
const ai = useAiStore()

const profile = computed(() => auth.user?.profile || {})
const selectedCourseId = ref(profile.value.courseIds?.[0] || null)

const query = ref('')
const filter = ref('all') // all | continue | new | weak
const sort = ref('recommended') // recommended | title | questions | accuracy | progress
const showAi = ref(false)

const aiTopic = ref('')
const aiDifficulty = ref('mixed')
const aiCount = ref(8)
const aiError = ref('')

const duelBusy = ref({})

const myCourses = computed(() =>
  (catalog.courses || []).filter((c) => (profile.value.courseIds || []).includes(c.id))
)
const courseOptions = computed(() =>
  myCourses.value.map((c) => ({ value: c.id, label: `${c.code} (${c.level})` }))
)

watch(selectedCourseId, async (cid) => {
  await content.fetchBanks({ courseId: cid || '' })
})

onMounted(async () => {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
  await content.fetchBanks({ courseId: selectedCourseId.value || '' })
})

const bankLabel = (b) => bankMeta(b).label

function getBankStats(bankId) {
  const s = data.answers?.[bankId] || { answeredIds: [], correctIds: [] }
  const answered = s.answeredIds?.length || 0
  const correct = s.correctIds?.length || 0
  const acc = answered ? Math.round((correct / answered) * 100) : 0
  return { answered, correct, acc }
}

const goalPct = computed(() => {
  const goal = Number(data.progress?.dailyGoal || 10)
  const done = Number(data.progress?.todayAnswered || 0)
  if (!goal) return 0
  return Math.max(0, Math.min(100, Math.round((done / goal) * 100)))
})

const rawBanks = computed(() => content.banks || [])

const banks = computed(() => {
  const list = rawBanks.value || []
  const q = query.value.trim().toLowerCase()

  // search
  let out = !q
    ? list
    : list.filter((b) => {
        const hay = [b.title, bankLabel(b)].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })

  // filter
  out = out.filter((b) => {
    const st = getBankStats(b.id)
    if (filter.value === 'continue') return st.answered > 0
    if (filter.value === 'new') return st.answered === 0
    if (filter.value === 'weak') return st.answered >= 5 && st.acc < 60
    return true
  })

  // sort
  out = [...out].sort((a, b) => {
    const sa = getBankStats(a.id)
    const sb = getBankStats(b.id)

    if (sort.value === 'title') return String(a.title || '').localeCompare(String(b.title || ''))
    if (sort.value === 'questions') return (b.questionCount || 0) - (a.questionCount || 0)
    if (sort.value === 'accuracy') return (sb.acc || 0) - (sa.acc || 0)

    if (sort.value === 'progress') {
      const ap = (a.questionCount || 0) ? sa.answered / (a.questionCount || 1) : 0
      const bp = (b.questionCount || 0) ? sb.answered / (b.questionCount || 1) : 0
      return bp - ap
    }

    // recommended: continue first, then weak, then new; within each group -> more questions
    const aAnswered = sa.answered > 0 ? 1 : 0
    const bAnswered = sb.answered > 0 ? 1 : 0
    if (bAnswered !== aAnswered) return bAnswered - aAnswered

    const aWeak = sa.answered >= 5 && sa.acc < 60 ? 1 : 0
    const bWeak = sb.answered >= 5 && sb.acc < 60 ? 1 : 0
    if (bWeak !== aWeak) return bWeak - aWeak

    return (b.questionCount || 0) - (a.questionCount || 0)
  })

  return out
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
  } finally {
    duelBusy.value = { ...duelBusy.value, [bankId]: false }
  }
}
</script>

<template>
  <div class="page">
    <!-- HERO / STATS -->
    <AppCard>
      <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div class="min-w-0">
          <div class="kicker">Practice</div>
          <div class="h1 mt-1">Quick drills</div>
          <p class="sub mt-2 max-w-[65ch]">
            Pick a bank, answer fast, learn from explanations, repeat. Keep it simple and consistent.
          </p>

          <div class="mt-4 grid grid-cols-3 gap-2">
            <StatPill label="Streak" :value="data.progress?.streak || 0" />
            <StatPill label="Accuracy" :value="(data.progress?.accuracy ?? 0) + '%'" />
            <StatPill label="Answered" :value="data.progress?.totalAnswered || 0" />
          </div>

          <div class="mt-4 card card-pad">
            <div class="flex items-center justify-between text-sm font-semibold">
              <span>Today</span>
              <span class="text-text-2">
                Level {{ data.progress?.level || 1 }} • {{ data.progress?.xp || 0 }} XP
              </span>
            </div>

            <div class="mt-2 flex items-center justify-between text-xs text-text-3">
              <span>Goal</span>
              <span>{{ data.progress?.todayAnswered || 0 }} / {{ data.progress?.dailyGoal || 10 }}</span>
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
            <button type="button" class="btn btn-ghost btn-sm" @click="router.push('/practice/review')">
              Smart Review
              <span v-if="data.progress?.dueReviews" class="badge ml-2">{{ data.progress.dueReviews }}</span>
            </button>

            <button type="button" class="btn btn-ghost btn-sm" @click="router.push('/progress')">
              Progress
            </button>

            <button type="button" class="btn btn-ghost btn-sm" @click="router.push('/leaderboard')">
              Leaderboard
            </button>

            <button type="button" class="btn btn-ghost btn-sm" @click="showAi = !showAi">
              {{ showAi ? 'Hide' : 'Show' }} AI quiz generator
            </button>
          </div>
        </div>

        <div class="w-full lg:w-[360px]">
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

      <!-- Sticky-like control bar -->
      <div class="mt-4 grid gap-3 lg:grid-cols-12">
        <div class="lg:col-span-6">
          <label class="label" for="banksearch">Search</label>
          <AppInput id="banksearch" v-model="query" placeholder="Search banks… e.g., ANA 201" />
        </div>

        <div class="lg:col-span-3">
          <label class="label">Filter</label>
          <div class="seg w-full">
            <button type="button" class="seg-btn" :class="filter==='all'?'seg-btn--active':'seg-btn--inactive'" @click="filter='all'">All</button>
            <button type="button" class="seg-btn" :class="filter==='continue'?'seg-btn--active':'seg-btn--inactive'" @click="filter='continue'">Continue</button>
            <button type="button" class="seg-btn" :class="filter==='new'?'seg-btn--active':'seg-btn--inactive'" @click="filter='new'">New</button>
            <button type="button" class="seg-btn" :class="filter==='weak'?'seg-btn--active':'seg-btn--inactive'" @click="filter='weak'">Weak</button>
          </div>
        </div>

        <div class="lg:col-span-3">
          <label class="label" for="sort">Sort</label>
          <select id="sort" v-model="sort" class="input">
            <option value="recommended">Recommended</option>
            <option value="title">Title</option>
            <option value="questions">Most questions</option>
            <option value="accuracy">Highest accuracy</option>
            <option value="progress">Most progress</option>
          </select>
        </div>
      </div>

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">{{ content.error }}</div>
    </AppCard>

    <!-- AI Generator (collapsible) -->
    <AppCard v-if="showAi" class="mt-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="h2">AI quick quiz</div>
          <p class="sub mt-1">Generate a fresh MCQ bank for the selected course.</p>
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
          :disabled="!selectedCourseId || ai.loading?.generateBank"
          @click="generateAiBank"
        >
          <span v-if="!ai.loading?.generateBank">Generate bank</span>
          <span v-else>Generating…</span>
        </button>
      </div>

      <div v-if="aiError" class="alert alert-warn mt-3" role="alert">{{ aiError }}</div>
      <p class="help mt-2">AI banks are saved like normal banks so you can revisit them later.</p>
    </AppCard>

    <!-- BANKS -->
    <AppCard v-if="content.loading?.banks" class="mt-3">
      <div class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <AppCard v-else-if="banks.length === 0" class="mt-3">
      <div class="h2">No banks found</div>
      <p class="sub mt-1">
        Try a different search, filter, or course. New banks will appear as they are added.
      </p>
    </AppCard>

    <div v-else class="mt-3 grid gap-3">
      <div v-for="b in banks" :key="b.id" class="card card-pad">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-base font-extrabold truncate">{{ b.title }}</div>

            <div class="text-sm text-text-2 mt-1">
              {{ b.questionCount }} questions
              <span class="text-text-3">•</span>
              {{ bankLabel(b) }}
            </div>

            <div class="mt-3">
              <div class="flex items-center justify-between text-xs text-text-3">
                <span>Progress</span>
                <span>
                  {{ getBankStats(b.id).answered }} / {{ b.questionCount || 0 }}
                  <span v-if="getBankStats(b.id).answered"> • {{ getBankStats(b.id).acc }}%</span>
                </span>
              </div>
              <div class="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  class="h-full bg-accent transition-all duration-200"
                  :style="{
                    width: (b.questionCount ? Math.min(100, Math.round((getBankStats(b.id).answered / b.questionCount) * 100)) : 0) + '%'
                  }"
                />
              </div>
            </div>
          </div>

          <div class="flex flex-col items-end gap-2 shrink-0">
            <RouterLink :to="`/practice/${b.id}`" class="btn btn-primary btn-sm">
              {{ getBankStats(b.id).answered ? 'Continue' : 'Start' }}
            </RouterLink>

            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="!!duelBusy[b.id]"
              @click="challengeFriend(b.id)"
            >
              {{ duelBusy[b.id] ? 'Creating…' : 'Challenge' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
