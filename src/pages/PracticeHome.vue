<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'

const route = useRoute()
const router = useRouter()
const content = useContentStore()
const data = useDataStore()

const bankId = computed(() => route.params.bankId || route.params.id)
const qIndex = ref(0)
const selected = ref(null)
const reveal = ref(false)
const busy = ref(false)
const error = ref('')

// lightweight time tracking per question
const questionStartMs = ref(Date.now())

const bank = computed(() => content.bank)
const questions = computed(() => bank.value?.questions || [])
const current = computed(() => questions.value[qIndex.value] || null)

const bankStats = computed(() => data.answers?.[bankId.value] || { answeredIds: [], correctIds: [] })
const answeredCount = computed(() => bankStats.value.answeredIds?.length || 0)
const correctCount = computed(() => bankStats.value.correctIds?.length || 0)
const accuracy = computed(() => (answeredCount.value ? Math.round((correctCount.value / answeredCount.value) * 100) : 0))

const progressPct = computed(() => {
  const total = questions.value.length || 0
  if (!total) return 0
  return Math.min(100, Math.round(((qIndex.value + 1) / total) * 100))
})

const isLast = computed(() => qIndex.value >= (questions.value.length - 1))
const canSubmit = computed(() => !!current.value && selected.value !== null && !busy.value && !reveal.value)

watch(bankId, async (id) => {
  if (!id) return
  qIndex.value = 0
  selected.value = null
  reveal.value = false
  questionStartMs.value = Date.now()
  await load(id)
})

watch(
  () => current.value?.id,
  () => {
    // reset timer when question changes
    questionStartMs.value = Date.now()
  }
)

async function load(id) {
  error.value = ''
  await content.fetchBank(id)
  if (!content.bank || !content.bank.questions?.length) {
    error.value = 'This bank has no questions yet.'
  }
}

onMounted(async () => {
  await data.fetchProgress()
  await load(bankId.value)
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})

function pick(i) {
  if (reveal.value) return
  selected.value = i
}

async function submit() {
  if (!current.value) return
  if (selected.value === null) return

  busy.value = true
  try {
    const secondsSpent = Math.max(0, Math.round((Date.now() - questionStartMs.value) / 1000))

    const res = await data.submitAnswer({
      bankId: bankId.value,
      questionId: current.value.id,
      selectedIndex: selected.value,
      secondsSpent
    })

    reveal.value = true
    return res
  } catch (e) {
    error.value = e?.message || 'Failed to submit answer.'
  } finally {
    busy.value = false
  }
}

function next() {
  if (qIndex.value < questions.value.length - 1) {
    qIndex.value++
    selected.value = null
    reveal.value = false
    error.value = ''
    questionStartMs.value = Date.now()
  }
}

async function resetBank() {
  busy.value = true
  error.value = ''
  try {
    await data.resetBank(bankId.value)
    qIndex.value = 0
    selected.value = null
    reveal.value = false
    questionStartMs.value = Date.now()
  } catch (e) {
    error.value = e?.message || 'Failed to reset bank.'
  } finally {
    busy.value = false
  }
}

function backToBanks() {
  router.push('/practice')
}

function isCorrectOption(i) {
  return reveal.value && i === current.value?.answerIndex
}

function isWrongPicked(i) {
  return reveal.value && selected.value === i && i !== current.value?.answerIndex
}

function optionRingClass(i) {
  if (!reveal.value && selected.value === i) return 'ring-2 ring-accent/55'
  if (isCorrectOption(i)) return 'ring-2 ring-accent/60 bg-accent/10'
  if (isWrongPicked(i)) return 'ring-2 ring-danger/55 bg-danger/10'
  return ''
}

function onKeyDown(e) {
  // Avoid hijacking when user is typing in an input/textarea
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return

  // 1-9 selects options (A-I)
  if (!reveal.value && current.value?.options?.length) {
    const n = Number(e.key)
    if (n >= 1 && n <= Math.min(9, current.value.options.length)) {
      pick(n - 1)
      e.preventDefault()
      return
    }
  }

  // Enter submits / advances
  if (e.key === 'Enter') {
    if (canSubmit.value) submit()
    else if (reveal.value && !isLast.value) next()
  }

  // Escape goes back
  if (e.key === 'Escape') {
    backToBanks()
  }

  // ArrowRight to go next (after reveal)
  if (e.key === 'ArrowRight' && reveal.value && !isLast.value) {
    next()
  }
}
</script>

<template>
  <div class="page">
    <!-- Header / Stats -->
    <AppCard class="relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none opacity-40">
        <div class="h-full w-full bg-gradient-to-br from-accent/20 via-transparent to-transparent" />
      </div>

      <div class="relative flex flex-col gap-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="kicker">Practice bank</div>
            <div class="h1 mt-1 truncate">{{ bank?.title || 'Loading…' }}</div>
            <p class="sub mt-2 max-w-[70ch]">
              Pick an answer, reveal, and keep moving. (Shortcuts: 1–9 select • Enter reveal/next • Esc back)
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button class="btn btn-ghost btn-sm" @click="backToBanks">Banks</button>
            <button class="btn btn-ghost btn-sm" :disabled="busy" @click="resetBank">Reset</button>
          </div>
        </div>

        <div class="grid gap-2 sm:grid-cols-4">
          <div class="glass rounded-xl2 border border-stroke/60 px-4 py-3">
            <div class="text-xs text-text-3">Progress</div>
            <div class="text-sm font-bold mt-1">{{ qIndex + 1 }} / {{ questions.length || 0 }}</div>
          </div>
          <div class="glass rounded-xl2 border border-stroke/60 px-4 py-3">
            <div class="text-xs text-text-3">Answered</div>
            <div class="text-sm font-bold mt-1">{{ answeredCount }}</div>
          </div>
          <div class="glass rounded-xl2 border border-stroke/60 px-4 py-3">
            <div class="text-xs text-text-3">Accuracy</div>
            <div class="text-sm font-bold mt-1">{{ accuracy }}%</div>
          </div>
          <div class="glass rounded-xl2 border border-stroke/60 px-4 py-3">
            <div class="text-xs text-text-3">Correct</div>
            <div class="text-sm font-bold mt-1">{{ correctCount }}</div>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between text-xs text-text-3 mb-1">
            <span>Question {{ qIndex + 1 }}</span>
            <span>{{ progressPct }}%</span>
          </div>
          <div class="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              class="h-full bg-accent transition-all duration-200"
              :style="{ width: progressPct + '%' }"
            />
          </div>
        </div>

        <div v-if="content.loading.bank" class="grid gap-2">
          <div class="skeleton h-24" />
          <div class="skeleton h-12" />
          <div class="skeleton h-12" />
        </div>

        <div v-else-if="error" class="alert alert-warn" role="alert" aria-live="polite">
          {{ error }}
        </div>
      </div>
    </AppCard>

    <!-- Question -->
    <AppCard v-if="!content.loading.bank && current" class="relative">
      <div class="flex items-center justify-between gap-3">
        <div class="kicker">Question {{ qIndex + 1 }}</div>
        <span class="badge badge-soft" v-if="reveal">
          {{ selected === current.answerIndex ? 'Correct' : 'Review' }}
        </span>
      </div>

      <div class="mt-1 text-lg sm:text-xl font-extrabold leading-snug">
        {{ current.question }}
      </div>

      <div class="mt-4 grid gap-2">
        <button
          v-for="(opt, i) in current.options"
          :key="i"
          type="button"
          class="card card-press card-pad text-left focus:outline-none focus:ring-2 focus:ring-accent/50"
          :class="[optionRingClass(i)]"
          :disabled="busy"
          @click="pick(i)"
        >
          <div class="flex items-start gap-3">
            <div
              class="mt-0.5 h-7 w-7 rounded-full border border-stroke/60 grid place-items-center text-xs font-extrabold"
              :class="[
                isCorrectOption(i) ? 'border-accent/60 bg-accent/10' : '',
                isWrongPicked(i) ? 'border-danger/60 bg-danger/10' : ''
              ]"
              aria-hidden="true"
            >
              {{ String.fromCharCode(65 + i) }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="text-sm sm:text-base font-semibold text-text">
                {{ opt }}
              </div>

              <div v-if="isCorrectOption(i)" class="text-xs text-text-2 mt-1">
                Correct answer
              </div>
              <div v-else-if="isWrongPicked(i)" class="text-xs text-danger mt-1">
                Your choice
              </div>
              <div v-else-if="!reveal && selected === i" class="text-xs text-text-3 mt-1">
                Selected (press Enter to reveal)
              </div>
            </div>

            <div v-if="reveal" class="text-xs text-text-3">
              <span v-if="isCorrectOption(i)" class="text-accent font-semibold">✓</span>
              <span v-else-if="isWrongPicked(i)" class="text-danger font-semibold">✕</span>
            </div>
          </div>
        </button>
      </div>

      <div v-if="reveal" class="mt-4 alert alert-ok" role="status" aria-live="polite">
        <div class="font-semibold">Explanation</div>
        <div class="mt-1 text-sm text-text-2">
          {{ current.explanation || 'No explanation provided yet.' }}
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-5 flex flex-col sm:flex-row gap-2">
        <AppButton
          v-if="!reveal"
          class="w-full sm:w-auto"
          :disabled="!canSubmit"
          @click="submit"
        >
          <span v-if="!busy">Reveal answer</span>
          <span v-else>Submitting…</span>
        </AppButton>

        <AppButton
          v-else
          class="w-full sm:w-auto"
          :disabled="isLast"
          @click="next"
        >
          Next question
        </AppButton>

        <button class="btn btn-ghost w-full sm:w-auto" :disabled="busy" @click="backToBanks">
          Back to banks
        </button>

        <button
          v-if="reveal && isLast"
          class="btn w-full sm:w-auto"
          :disabled="busy"
          @click="resetBank"
          title="Restart this bank"
        >
          Restart bank
        </button>
      </div>

      <div class="mt-3 text-xs text-text-3">
        Shortcuts: <span class="font-semibold">1–9</span> select • <span class="font-semibold">Enter</span> reveal/next •
        <span class="font-semibold">→</span> next (after reveal) • <span class="font-semibold">Esc</span> back
      </div>
    </AppCard>

    <AppCard v-else-if="!content.loading.bank" class="alert alert-ok" role="status">
      No questions to practice right now.
    </AppCard>
  </div>
</template>
