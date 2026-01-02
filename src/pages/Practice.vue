<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import { useAiStore } from '../stores/ai'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'

const route = useRoute()
const router = useRouter()
const content = useContentStore()
const data = useDataStore()
const ai = useAiStore()

const bankId = computed(() => route.params.bankId || route.params.id)

const mode = computed(() => String(route.query.mode || 'normal')) // normal | retry | wrong | timed
const mins = computed(() => {
  const n = Number(route.query.mins || 0)
  return Number.isFinite(n) && n > 0 ? n : 10
})

const sessionQuestions = ref([]) // questions for current session (can be shuffled/filtered)
const qStartedAt = ref(Date.now())

const remaining = ref(0)
const timeUp = ref(false)
let timerId = null

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function setMode(next) {
  const q = { ...(route.query || {}) }
  if (!next || next === 'normal') {
    delete q.mode
    delete q.mins
  } else {
    q.mode = next
    if (next === 'timed') q.mins = String(mins.value || 10)
    else delete q.mins
  }
  router.replace({ query: q })
}

function setTimedMins(m) {
  const q = { ...(route.query || {}), mode: 'timed', mins: String(m) }
  router.replace({ query: q })
}

function formatRemaining() {
  const s = Math.max(0, remaining.value)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

const qIndex = ref(0)
const selected = ref(null)
const reveal = ref(false)
const busy = ref(false)
const error = ref('')

const aiHint = ref('')
const aiExplanation = ref(null)
const aiBusy = ref(false)
const aiError = ref('')

const bank = computed(() => content.bank)
const questions = computed(() => bank.value?.questions || [])
const current = computed(() => sessionQuestions.value[qIndex.value] || null)

const bankStats = computed(() => data.answers?.[bankId.value] || { answeredIds: [], correctIds: [] })
const answeredCount = computed(() => bankStats.value.answeredIds?.length || 0)
const correctCount = computed(() => bankStats.value.correctIds?.length || 0)
const accuracy = computed(() =>
  answeredCount.value ? Math.round((correctCount.value / answeredCount.value) * 100) : 0
)

const progressPct = computed(() => {
  const total = questions.value.length || 0
  if (!total) return 0
  return Math.min(100, Math.round(((qIndex.value + 1) / total) * 100))
})

watch(bankId, async (id) => {
  if (!id) return
  await load(id)
  buildSessionQuestions()
  startTimerIfNeeded()
})

watch(mode, () => {
  buildSessionQuestions()
  startTimerIfNeeded()
})

watch(mins, () => {
  if (mode.value === 'timed') startTimerIfNeeded()
})

function startTimerIfNeeded() {
  if (timerId) {
    window.clearInterval(timerId)
    timerId = null
  }
  timeUp.value = false
  remaining.value = Math.max(0, mins.value * 60)

  if (mode.value !== 'timed') return

  timerId = window.setInterval(() => {
    if (remaining.value <= 0) {
      timeUp.value = true
      window.clearInterval(timerId)
      timerId = null
      return
    }
    remaining.value -= 1
  }, 1000)
}

function buildSessionQuestions() {
  const all = questions.value || []
  const stats = bankStats.value || { answeredIds: [], correctIds: [] }
  const answered = new Set((stats.answeredIds || []).map(String))
  const correct = new Set((stats.correctIds || []).map(String))

  let list = [...all]

  if (mode.value === 'retry') {
    list = list.filter((q) => !answered.has(String(q.id)))
  } else if (mode.value === 'wrong') {
    list = list.filter((q) => answered.has(String(q.id)) && !correct.has(String(q.id)))
  }

  sessionQuestions.value = shuffle(list)

  // reset state
  qIndex.value = 0
  selected.value = null
  reveal.value = false
  error.value = ''
  aiHint.value = ''
  aiExplanation.value = null
  aiError.value = ''
  qStartedAt.value = Date.now()
}

async function load(id) {
  try {
    await content.fetchBank(id)
  } catch (e) {
    error.value = e?.message || 'Failed to load practice bank.'
  }
}

onMounted(async () => {
  await data.fetchProgress()
  await load(bankId.value)
  buildSessionQuestions()
  startTimerIfNeeded()
})

onUnmounted(() => {
  if (timerId) window.clearInterval(timerId)
})

function pick(i) {
  if (reveal.value) return
  if (mode.value === 'timed' && timeUp.value) return
  selected.value = i
}

async function submit() {
  if (!current.value) return
  if (selected.value === null) return
  if (mode.value === 'timed' && timeUp.value) return

  busy.value = true
  error.value = ''
  try {
    const secondsSpent = Math.max(0, Math.round((Date.now() - qStartedAt.value) / 1000))
    await data.submitAnswer({
      bankId: bankId.value,
      questionId: current.value.id,
      selectedIndex: selected.value,
      secondsSpent
    })
    reveal.value = true
  } catch (e) {
    error.value = e?.message || 'Failed to submit answer.'
  } finally {
    busy.value = false
  }
}

async function getAiHint() {
  if (!current.value) return
  aiBusy.value = true
  aiError.value = ''
  try {
    const res = await ai.explainMCQ({
      bankId: bankId.value,
      questionId: current.value.id,
      mode: 'hint',
      selectedIndex: selected.value
    })
    aiHint.value = res?.hint || res?.text || ''
  } catch (e) {
    aiError.value = e?.message || 'AI hint failed'
  } finally {
    aiBusy.value = false
  }
}

async function getAiExplanation() {
  if (!current.value) return
  aiBusy.value = true
  aiError.value = ''
  try {
    const res = await ai.explainMCQ({
      bankId: bankId.value,
      questionId: current.value.id,
      mode: 'full',
      selectedIndex: selected.value
    })
    aiExplanation.value = res || null
  } catch (e) {
    aiError.value = e?.message || 'AI explanation failed'
  } finally {
    aiBusy.value = false
  }
}

function next() {
  if (qIndex.value < questions.value.length - 1) {
    qIndex.value++
    selected.value = null
    reveal.value = false
  }
}

async function resetBank() {
  if (!bankId.value) return
  busy.value = true
  error.value = ''
  try {
    await data.resetBank({ bankId: bankId.value })
    await data.fetchProgress()
    buildSessionQuestions()
    startTimerIfNeeded()
  } catch (e) {
    error.value = e?.message || 'Failed to reset bank.'
  } finally {
    busy.value = false
  }
}

function backToBanks() {
  router.push('/practice')
}
</script>

<template>
  <div class="page">
    <AppCard v-if="current" class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
      <div class="relative flex flex-col gap-5">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="min-w-0">
            <div class="kicker">Practice bank</div>
            <div class="h1 mt-1 clamp-2">{{ bank?.title || 'Loading…' }}</div>
            <p class="sub mt-2">Answer, reveal, then move fast. Keep it focused.</p>

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="text-xs text-text-3">Mode:</span>

              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :class="mode === 'normal' ? 'ring-1 ring-accent/50' : ''"
                :aria-pressed="mode === 'normal'"
                @click="setMode('normal')"
              >
                Normal
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :class="mode === 'retry' ? 'ring-1 ring-accent/50' : ''"
                :aria-pressed="mode === 'retry'"
                @click="setMode('retry')"
              >
                Retry
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :class="mode === 'wrong' ? 'ring-1 ring-accent/50' : ''"
                :aria-pressed="mode === 'wrong'"
                @click="setMode('wrong')"
              >
                Wrong only
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :class="mode === 'timed' ? 'ring-1 ring-accent/50' : ''"
                :aria-pressed="mode === 'timed'"
                @click="setMode('timed')"
              >
                Timed
              </button>

              <span class="chip ml-1">
                <span class="text-text-3">Now:</span>
                <span class="font-semibold">
                  {{ mode === 'retry' ? 'Retry' : mode === 'wrong' ? 'Wrong only' : mode === 'timed' ? `Timed (${mins}m)` : 'Normal' }}
                </span>
              </span>

              <div v-if="mode === 'timed'" class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-text-3">Duration:</span>
                <button type="button" class="btn btn-ghost btn-sm" @click="setTimedMins(5)">5m</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="setTimedMins(10)">10m</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="setTimedMins(20)">20m</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="setTimedMins(30)">30m</button>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button class="btn btn-ghost btn-sm" @click="backToBanks">Banks</button>
            <button class="btn btn-ghost btn-sm" :disabled="busy" @click="resetBank">Reset</button>
          </div>
        </div>

        <!-- Session overview -->
        <div class="panel p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="badge">Question {{ qIndex + 1 }} / {{ sessionQuestions.length || 0 }}</span>
              <span class="badge">Answered {{ answeredCount }}</span>
              <span class="badge">Accuracy {{ accuracy }}%</span>
              <span class="badge">Correct {{ correctCount }}</span>

              <span v-if="mode === 'timed'" class="badge">
                {{ timeUp ? 'Time up' : 'Time left' }}: {{ formatRemaining() }}
              </span>
            </div>

            <div class="text-xs text-text-3">
              Tip: tap an option, then <span class="text-text font-semibold">Reveal</span>.
            </div>
          </div>

          <div class="mt-3">
            <div class="flex items-center justify-between text-xs text-text-3">
              <span>Session progress</span>
              <span class="font-semibold text-text">{{ progressPct }}%</span>
            </div>
            <div class="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div class="h-full bg-accent/70" :style="{ width: progressPct + '%' }" />
            </div>
          </div>

          <div v-if="timeUp" class="alert alert-warn mt-3" role="alert">
            Time’s up. Switch to <b>Normal</b> mode or reset the bank to try again.
          </div>
          <div v-else-if="error" class="alert alert-warn mt-3" role="alert">{{ error }}</div>
        </div>

        <!-- Question -->
        <div class="panel p-4">
          <div class="kicker">Question</div>
          <div class="mt-1 text-lg sm:text-xl font-extrabold leading-snug whitespace-pre-line">
            {{ current.question }}
          </div>
        </div>

        <!-- Options -->
        <div class="grid gap-2" role="radiogroup" aria-label="Answer options">
          <button
            v-for="(opt, i) in current.options"
            :key="i"
            type="button"
            class="card card-press card-pad text-left"
            :class="[
              selected === i ? 'ring-2 ring-accent/50' : '',
              reveal && i === current.answerIndex ? 'ring-2 ring-accent/55 bg-accent/10' : '',
              reveal && selected === i && i !== current.answerIndex ? 'ring-2 ring-danger/45 bg-danger/10' : ''
            ]"
            :aria-pressed="selected === i"
            :disabled="reveal || (mode === 'timed' && timeUp)"
            @click="pick(i)"
          >
            <div class="flex items-start gap-3">
              <div class="mt-0.5 h-6 w-6 rounded-full border border-stroke/60 grid place-items-center text-xs font-bold">
                {{ String.fromCharCode(65 + i) }}
              </div>
              <div class="min-w-0">
                <div class="text-sm font-semibold text-text">{{ opt }}</div>
                <div v-if="reveal && i === current.answerIndex" class="text-xs text-text-2 mt-1">Correct answer</div>
                <div v-else-if="reveal && selected === i && i !== current.answerIndex" class="text-xs text-danger mt-1">
                  Your choice
                </div>
              </div>
            </div>
          </button>
        </div>

        <!-- AI hint (before reveal) -->
        <div v-if="!reveal" class="panel p-4">
          <div class="flex flex-col sm:flex-row sm:items-center gap-2">
            <button class="btn btn-ghost w-full sm:w-auto" :disabled="aiBusy" @click="getAiHint">
              <span v-if="!aiBusy">Get AI hint</span>
              <span v-else>Thinking…</span>
            </button>
            <p class="help">Quick nudge — without giving the answer away.</p>
          </div>

          <div v-if="aiError" class="alert alert-warn mt-3" role="alert">{{ aiError }}</div>
          <div v-else-if="aiHint" class="alert alert-ok mt-3" role="status">
            <div class="font-semibold">Hint</div>
            <div class="mt-1 text-sm text-text-2">{{ aiHint }}</div>
          </div>
        </div>

        <!-- Explanation (after reveal) -->
        <div v-if="reveal" class="panel p-4">
          <div class="h2">Explanation</div>
          <div class="mt-2 text-sm text-text-2">
            {{ current.explanation || 'No explanation provided yet.' }}
          </div>

          <div class="mt-3">
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
              <button class="btn btn-ghost w-full sm:w-auto" :disabled="aiBusy" @click="getAiExplanation">
                <span v-if="!aiBusy">Explain with AI</span>
                <span v-else>Thinking…</span>
              </button>
              <p class="help">Deeper explanation + why other options are wrong.</p>
            </div>

            <div v-if="aiError" class="alert alert-warn mt-3" role="alert">{{ aiError }}</div>
            <div v-else-if="aiExplanation" class="alert alert-ok mt-3" role="status">
              <div class="font-semibold">AI explanation</div>

              <div v-if="aiExplanation.explanation" class="mt-1 text-sm text-text-2">{{ aiExplanation.explanation }}</div>

              <ul v-if="aiExplanation.steps?.length" class="mt-2 text-sm text-text-2 list-disc pl-5">
                <li v-for="(s, i) in aiExplanation.steps" :key="i">{{ s }}</li>
              </ul>

              <ul v-if="aiExplanation.whyOthersAreWrong?.length" class="mt-2 text-sm text-text-2 list-disc pl-5">
                <li v-for="(s, i) in aiExplanation.whyOthersAreWrong" :key="'w' + i">{{ s }}</li>
              </ul>

              <div v-if="aiExplanation.keyTakeaway" class="mt-2 text-sm text-text-2">
                <span class="font-semibold text-text">Key takeaway:</span> {{ aiExplanation.keyTakeaway }}
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="panel p-4">
          <div class="flex flex-col sm:flex-row gap-2">
            <AppButton
              v-if="!reveal"
              class="w-full sm:w-auto"
              :disabled="busy || selected === null || (mode === 'timed' && timeUp)"
              @click="submit"
            >
              <span v-if="!busy">Reveal answer</span>
              <span v-else>Submitting…</span>
            </AppButton>

            <AppButton
              v-else
              class="w-full sm:w-auto"
              :disabled="busy || (mode === 'timed' && timeUp)"
              @click="next"
            >
              Next question
            </AppButton>

            <button class="btn btn-ghost w-full sm:w-auto" @click="backToBanks">Back to banks</button>
          </div>

          <p class="help mt-2">
            Focus on speed + accuracy. If you get stuck, use a hint — then keep moving.
          </p>
        </div>
      </div>
    </AppCard>

    <AppCard v-else-if="content.loading.bank" class="skeleton">Loading bank…</AppCard>

    <AppCard v-else class="alert alert-ok" role="status">
      No questions to practice right now.
    </AppCard>
  </div>
</template>
