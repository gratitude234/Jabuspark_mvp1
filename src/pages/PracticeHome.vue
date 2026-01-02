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
    const hay = [b.title, bankMeta(b).label].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
})

const bankLabel = (b) => bankMeta(b).label

const progress = computed(() => data.progress || {})

const goalPct = computed(() => {
  const goal = Number(progress.value?.dailyGoal || 10)
  const done = Number(progress.value?.todayAnswered || 0)
  if (!goal) return 0
  return Math.max(0, Math.min(100, Math.round((done / goal) * 100)))
})

const bankCountLabel = computed(() => {
  const n = banks.value.length || 0
  return n === 1 ? '1 bank' : `${n} banks`
})

const selectedCourseLabel = computed(() => {
  const cid = selectedCourseId.value
  if (!cid) return 'All my courses'
  const c = (catalog.courses || []).find(x => String(x.id) === String(cid))
  return c ? `${c.code} (${c.level})` : 'Selected course'
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
  <div class="page">
    <!-- HERO / OVERVIEW -->
    <AppCard class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-transparent" />

      <div class="relative flex flex-col gap-5">
        <!-- Top row -->
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div class="min-w-0">
            <div class="kicker">Practice</div>
            <div class="h1 mt-1">Build recall fast</div>
            <p class="sub mt-2 max-w-[70ch]">
              Quick drills to boost confidence. Choose a course, pick a bank, and keep momentum.
            </p>

            <!-- Stats -->
            <div class="mt-4 grid grid-cols-3 gap-2">
              <StatPill label="Streak" :value="progress?.streak ?? 0" />
              <StatPill label="Accuracy" :value="(progress?.accuracy ?? 0) + '%'" />
              <StatPill label="Answered" :value="progress?.totalAnswered ?? 0" />
            </div>

            <!-- Quick actions -->
            <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button type="button" class="btn btn-ghost w-full justify-between" @click="router.push('/practice/review')">
                <span class="font-semibold">Smart Review</span>
                <span v-if="progress?.dueReviews" class="badge">{{ progress.dueReviews }}</span>
              </button>

              <button type="button" class="btn btn-ghost w-full justify-between" @click="router.push('/exam')">
                <span class="font-semibold">Exam Mode</span>
                <span class="text-xs text-text-3">Timed</span>
              </button>

              <button type="button" class="btn btn-ghost w-full justify-between" @click="router.push('/progress')">
                <span class="font-semibold">Progress</span>
                <span class="text-xs text-text-3">Stats</span>
              </button>

              <button type="button" class="btn btn-ghost w-full justify-between" @click="router.push('/leaderboard')">
                <span class="font-semibold">Leaderboard</span>
                <span class="text-xs text-text-3">Rank</span>
              </button>
            </div>
          </div>

          <!-- Right column: Course + Today -->
          <div class="w-full lg:w-[380px] flex flex-col gap-3">
            <div class="panel p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-sm font-extrabold">Course focus</div>
                  <p class="help mt-1">Pick a course to see only its banks.</p>
                </div>
                <span class="chip">{{ selectedCourseLabel }}</span>
              </div>

              <div class="mt-3">
                <label class="label" for="course">Course</label>
                <AppSelect
                  id="course"
                  v-model="selectedCourseId"
                  :options="courseOptions"
                  placeholder="All my courses"
                />
              </div>

              <div v-if="(profile?.courseIds || []).length === 0" class="alert alert-warn mt-3" role="alert">
                You haven’t selected any courses yet. Update your profile to get personalized banks.
              </div>
            </div>

            <div class="panel p-4">
              <div class="flex items-center justify-between">
                <div class="text-sm font-extrabold">Today</div>
                <div class="text-xs text-text-3">
                  Level {{ progress?.level ?? 0 }} • {{ progress?.xp ?? 0 }} XP
                </div>
              </div>

              <div class="mt-2 flex items-center justify-between text-xs text-text-3">
                <span>Daily goal</span>
                <span class="font-semibold text-text">
                  {{ progress?.todayAnswered ?? 0 }} / {{ progress?.dailyGoal ?? 10 }}
                </span>
              </div>

              <div class="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div class="h-full bg-accent transition-all duration-200" :style="{ width: goalPct + '%' }" />
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(10)">Goal 10</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(20)">Goal 20</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="data.setDailyGoal(50)">Goal 50</button>
              </div>

              <p class="help mt-2">Small daily consistency beats long once-a-week grind.</p>
            </div>
          </div>
        </div>

        <!-- Search bar -->
        <div class="panel p-4">
          <div class="flex flex-col sm:flex-row sm:items-end gap-3">
            <div class="flex-1">
              <label class="label" for="banksearch">Search banks</label>
              <AppInput
                id="banksearch"
                v-model="query"
                placeholder="Search by title or type… (e.g. ‘GNS’, ‘Anatomy’, ‘Past questions’)"
              />
              <p class="help mt-2">Tip: search is instant — keep it short.</p>
            </div>

            <div class="sm:w-[220px]">
              <div class="label">Showing</div>
              <div class="chip w-full justify-between">
                <span class="text-text-3">Results</span>
                <span class="font-semibold">{{ bankCountLabel }}</span>
              </div>
            </div>
          </div>

          <div v-if="content.error" class="alert alert-warn mt-4" role="alert">
            {{ content.error }}
          </div>
        </div>
      </div>
    </AppCard>

    <!-- AI Generator -->
    <AppCard class="mt-3">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h2">AI quick quiz</div>
          <p class="sub mt-1">
            Generate a fresh MCQ bank for <b>{{ selectedCourseLabel }}</b>.
          </p>
        </div>

        <div class="chip">
          <span class="text-text-3">Powered by</span>
          <span class="font-semibold">Gemini</span>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="sm:col-span-2">
          <label class="label" for="aiTopic">Topic (optional)</label>
          <AppInput id="aiTopic" v-model="aiTopic" placeholder="e.g., Embryology: gastrulation" />
          <p class="help mt-2">Leave blank to generate a mixed set across the course.</p>
        </div>

        <div>
          <label class="label" for="aiCount">Questions</label>
          <AppInput id="aiCount" v-model="aiCount" type="number" min="3" max="20" placeholder="8" />
          <p class="help mt-2">3–20 recommended.</p>
        </div>
      </div>

      <div class="mt-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div class="w-full sm:w-[240px]">
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

      <div v-if="!selectedCourseId" class="alert alert-warn mt-3" role="alert">
        Select a course first to generate an AI bank.
      </div>
      <div v-if="aiError" class="alert alert-warn mt-3" role="alert">{{ aiError }}</div>
      <p class="help mt-2">AI banks are saved like normal banks so you can return anytime.</p>
    </AppCard>

    <!-- Banks -->
    <AppCard v-if="content.loading.banks" class="mt-3">
      <div class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <AppCard v-else-if="banks.length === 0" class="mt-3">
      <div class="h2">No banks found</div>
      <p class="sub mt-1">
        Try a different search, pick another course, or check back later as more banks are added.
      </p>
      <div class="mt-4 flex flex-col sm:flex-row gap-2">
        <button class="btn btn-ghost w-full sm:w-auto" @click="query = ''">Clear search</button>
        <button class="btn btn-primary w-full sm:w-auto" @click="router.push('/practice/review')">Go to Smart Review</button>
      </div>
    </AppCard>

    <div v-else class="mt-3 grid gap-3">
      <div class="flex items-center justify-between">
        <div class="h2">Available banks</div>
        <div class="text-xs text-text-3">
          Showing <span class="font-semibold text-text">{{ banks.length }}</span>
        </div>
      </div>

      <div v-for="b in banks" :key="b.id" class="card card-pad">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="min-w-0">
            <div class="text-base font-extrabold truncate">{{ b.title }}</div>
            <div class="text-sm text-text-2 mt-1 flex flex-wrap items-center gap-2">
              <span class="chip">{{ b.questionCount }} questions</span>
              <span class="chip">{{ bankLabel(b) }}</span>
            </div>
          </div>

          <div class="flex flex-col sm:items-end gap-2">
            <RouterLink :to="`/practice/${b.id}`" class="btn btn-primary btn-sm w-full sm:w-auto">
              Start practice
            </RouterLink>

            <button
              type="button"
              class="btn btn-ghost btn-sm w-full sm:w-auto"
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
