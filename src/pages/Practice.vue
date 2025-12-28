<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import StatPill from '../components/StatPill.vue'

const route = useRoute()
const router = useRouter()

const auth = useAuthStore()
const catalog = useCatalogStore()
const content = useContentStore()
const data = useDataStore()

const profile = computed(() => auth.user?.profile || {})
const bankId = computed(() => route.params.bankId || route.params.id)

const modeShuffle = computed(() => String(route.query.shuffle || '') === '1')
const modeTimed = computed(() => String(route.query.timed || '') === '1')
const modeMinutes = computed(() => {
  const n = Number(route.query.minutes || 10)
  if (!Number.isFinite(n)) return 10
  return Math.max(1, Math.min(60, Math.floor(n)))
})

const bank = computed(() => content.bank)
const questions = computed(() => bank.value?.questions || [])

// Order controls (supports shuffle + "retry wrong")
const order = ref([]) // array of indices into questions
const qPos = ref(0)
const qIndex = computed(() => order.value[qPos.value] ?? 0)
const q = computed(() => questions.value[qIndex.value] || null)

const selectedIndex = ref(null)
const reveal = ref(false)
const busy = ref(false)
const finished = ref(false)
const timeUp = ref(false)
const reviewOpen = ref(false)

// Timing
const questionStartedAt = ref(Date.now())
const timeLeft = ref(null) // seconds, null when not timed
let tick = null

const session = reactive({
  startedAt: Date.now(),
  attempts: {}, // { [questionId]: { selectedIndex, isCorrect, secondsSpent } }
})

const sessionAnswered = computed(() => Object.keys(session.attempts).length)
const sessionCorrect = computed(() => Object.values(session.attempts).filter(a => a?.isCorrect).length)
const sessionAccuracy = computed(() => (sessionAnswered.value ? Math.round((sessionCorrect.value / sessionAnswered.value) * 100) : 0))

const overall = computed(() => data.answers?.[bankId.value] || { answeredIds: [], correctIds: [] })
const overallAnswered = computed(() => overall.value.answeredIds?.length || 0)
const overallCorrect = computed(() => overall.value.correctIds?.length || 0)
const overallAccuracy = computed(() => (overallAnswered.value ? Math.round((overallCorrect.value / overallAnswered.value) * 100) : 0))

const wrongInSession = computed(() => {
  const list = []
  for (const [qid, a] of Object.entries(session.attempts)) {
    if (!a?.isCorrect) list.push(qid)
  }
  return list
})

const wrongCards = computed(() => {
  const byId = new Map(questions.value.map((qq, idx) => [qq.id, { q: qq, idx }]))
  return wrongInSession.value
    .map((qid) => {
      const meta = byId.get(qid)
      return meta ? { ...meta, attempt: session.attempts[qid] } : null
    })
    .filter(Boolean)
})

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function stopTimer() {
  if (tick) {
    clearInterval(tick)
    tick = null
  }
}

function startTimer() {
  stopTimer()
  if (!modeTimed.value) {
    timeLeft.value = null
    return
  }
  timeLeft.value = modeMinutes.value * 60
  tick = setInterval(() => {
    if (timeLeft.value == null) return
    timeLeft.value = Math.max(0, timeLeft.value - 1)
    if (timeLeft.value === 0) {
      stopTimer()
      timeUp.value = true
      finished.value = true
      reveal.value = true
    }
  }, 1000)
}

function resetSessionState() {
  selectedIndex.value = null
  reveal.value = false
  finished.value = false
  timeUp.value = false
  reviewOpen.value = false
  session.startedAt = Date.now()
  session.attempts = {}
  questionStartedAt.value = Date.now()
  startTimer()
}

function buildOrder({ onlyWrong = false, forceShuffle = false } = {}) {
  const base = questions.value.map((_, idx) => idx)
  let indices = base

  if (onlyWrong) {
    const answered = overall.value.answeredIds || []
    const correct = overall.value.correctIds || []
    const wrong = answered.filter((id) => !correct.includes(id))
    if (wrong.length) {
      const set = new Set(wrong)
      indices = base.filter((idx) => set.has(questions.value[idx]?.id))
    }
  }

  const shouldShuffle = forceShuffle || modeShuffle.value
  if (shouldShuffle) indices = shuffleArray(indices)

  order.value = indices
  qPos.value = 0
  resetSessionState()
}

function fmtTime(secs) {
  const s = Math.max(0, Math.floor(secs || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

async function load() {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
  // fetchBank expects a string id; passing an object here becomes "[object Object]"
  // and causes the API call to hit /banks/%5Bobject%20Object%5D (404)
  await content.fetchBank(bankId.value)
  buildOrder()
}

onMounted(load)
watch(bankId, load)

watch(q, () => {
  questionStartedAt.value = Date.now()
  selectedIndex.value = null
  reveal.value = false
})

onBeforeUnmount(() => stopTimer())

async function submit() {
  if (!q.value || selectedIndex.value == null || busy.value || finished.value) return
  busy.value = true

  const secondsSpent = Math.max(0, Math.round((Date.now() - questionStartedAt.value) / 1000))
  try {
    const out = await data.submitAnswer({
      bankId: bankId.value,
      questionId: q.value.id,
      selectedIndex: selectedIndex.value,
      secondsSpent,
    })

    // Response: { isCorrect, correctIndex, explanation }
    session.attempts = {
      ...session.attempts,
      [q.value.id]: {
        selectedIndex: selectedIndex.value,
        isCorrect: !!out?.isCorrect,
        secondsSpent,
        correctIndex: out?.correctIndex,
        explanation: out?.explanation,
      },
    }

    reveal.value = true
  } finally {
    busy.value = false
  }
}

function next() {
  if (!reveal.value) return
  if (qPos.value < order.value.length - 1) {
    qPos.value += 1
    selectedIndex.value = null
    reveal.value = false
    return
  }
  finished.value = true
  reviewOpen.value = true
  stopTimer()
}

function retry({ onlyWrong = false } = {}) {
  buildOrder({ onlyWrong, forceShuffle: true })
}

function backToBanks() {
  router.push('/practice')
}

const title = computed(() => {
  const c = catalog.coursesById?.[bank.value?.courseId] || null
  const suffix = modeTimed.value ? ` • Timed (${modeMinutes.value}m)` : ''
  const prefix = modeShuffle.value ? ' • Shuffle' : ''
  return `${bank.value?.title || 'Practice'}${prefix}${suffix}${c ? ` — ${c.code}` : ''}`
})

const isLast = computed(() => qPos.value >= order.value.length - 1)
const progressText = computed(() => `${Math.min(order.value.length, qPos.value + 1)}/${order.value.length || 0}`)

</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">{{ title }}</div>
          <p class="sub mt-1">
            {{ bank?.mode === 'ai' ? 'AI-generated bank' : 'Practice bank' }} • {{ progressText }}
            <span v-if="modeTimed && timeLeft !== null"> • {{ fmtTime(timeLeft) }}</span>
          </p>
        </div>

        <div class="flex items-center gap-2">
          <AppButton variant="ghost" class="btn-sm" @click="backToBanks">Back</AppButton>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatPill label="Answered" :value="sessionAnswered" />
        <StatPill label="Accuracy" :value="sessionAccuracy + '%'" />
        <StatPill label="Correct" :value="sessionCorrect" />
        <StatPill label="Overall" :value="overallAccuracy + '%'" :sub="overallCorrect + '/' + overallAnswered" />
      </div>

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">{{ content.error }}</div>
    </AppCard>

    <!-- Finished / Summary -->
    <AppCard v-if="finished" class="mt-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="h2">Session summary</div>
          <p class="sub mt-1">
            You got <strong>{{ sessionCorrect }}</strong> out of <strong>{{ sessionAnswered }}</strong> correct.
            <span v-if="timeUp"> Time’s up.</span>
          </p>
        </div>
        <div class="text-right">
          <div class="text-3xl font-extrabold">{{ sessionAccuracy }}%</div>
          <div class="text-xs text-text-3">This session</div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <AppButton @click="retry({ onlyWrong: false })">Retry (shuffle)</AppButton>
        <AppButton variant="ghost" :disabled="wrongCards.length === 0" @click="retry({ onlyWrong: true })">
          Retry wrong (shuffle)
        </AppButton>
        <AppButton variant="ghost" @click="backToBanks">Choose another bank</AppButton>
      </div>

      <div class="divider mt-4" />

      <div class="row mt-4">
        <div>
          <div class="h3">Review wrong answers</div>
          <p class="help" v-if="wrongCards.length">Tap to see what you missed and why.</p>
          <p class="help" v-else>Nice work — no wrong answers in this session.</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" @click="reviewOpen = !reviewOpen">
          {{ reviewOpen ? 'Hide' : 'Show' }}
        </button>
      </div>

      <div v-if="reviewOpen" class="mt-3 space-y-3">
        <div v-for="item in wrongCards" :key="item.q.id" class="card card-pad">
          <div class="h3">{{ item.q.prompt }}</div>
          <div class="mt-3 space-y-2">
            <div
              v-for="(opt, idx) in (item.q.options || [])"
              :key="idx"
              class="rounded-xl2 border px-3 py-2 text-sm"
              :class="{
                'border-accent/50 bg-accent/10': idx === item.q.answerIndex,
                'border-danger/50 bg-danger/10': idx === item.attempt.selectedIndex && idx !== item.q.answerIndex,
                'border-stroke/60 bg-white/[0.02]': idx !== item.q.answerIndex && idx !== item.attempt.selectedIndex,
              }"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="min-w-0">{{ opt }}</span>
                <span class="badge" v-if="idx === item.q.answerIndex">Correct</span>
                <span class="badge" v-else-if="idx === item.attempt.selectedIndex">Your choice</span>
              </div>
            </div>
          </div>
          <div v-if="item.q.explain" class="mt-3 alert alert-ok">
            {{ item.q.explain }}
          </div>
        </div>
      </div>
    </AppCard>

    <!-- Question Card -->
    <AppCard v-else class="mt-3">
      <div v-if="q" class="space-y-4">
        <div class="h2">{{ q.prompt }}</div>

        <div class="grid gap-2">
          <button
            v-for="(opt, idx) in (q.options || [])"
            :key="idx"
            class="btn btn-ghost justify-between"
            :disabled="reveal || busy || timeUp"
            :class="{
              'ring-2 ring-accent/55': selectedIndex === idx,
              'border-accent/50 bg-accent/10': reveal && idx === q.answerIndex,
              'border-danger/50 bg-danger/10': reveal && selectedIndex === idx && idx !== q.answerIndex,
            }"
            @click="selectedIndex = idx"
          >
            <span class="text-left">{{ opt }}</span>
            <span v-if="reveal && idx === q.answerIndex" class="badge">Correct</span>
            <span v-else-if="reveal && selectedIndex === idx" class="badge">Your choice</span>
          </button>
        </div>

        <div v-if="reveal" class="alert" :class="(session.attempts?.[q.id]?.isCorrect ? 'alert-ok' : 'alert-warn')">
          <strong>{{ session.attempts?.[q.id]?.isCorrect ? 'Correct.' : 'Not quite.' }}</strong>
          <span v-if="q.explain"> {{ q.explain }}</span>
        </div>

        <div class="flex flex-col sm:flex-row gap-2">
          <AppButton :disabled="selectedIndex == null || reveal || busy || timeUp" @click="submit">
            {{ busy ? 'Checking…' : 'Check answer' }}
          </AppButton>
          <AppButton variant="ghost" :disabled="!reveal" @click="next">
            {{ isLast ? 'Finish' : 'Next' }}
          </AppButton>
        </div>
      </div>

      <div v-else class="sub">Loading…</div>
    </AppCard>
  </div>
</template>
