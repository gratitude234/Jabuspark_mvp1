<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/data'
import { useAiStore } from '../stores/ai'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import { toast } from '../utils/toast'

const router = useRouter()
const data = useDataStore()
const ai = useAiStore()

const loading = ref(false)
const error = ref('')
const qIndex = ref(0)
const selected = ref(null)
const reveal = ref(false)

// Smart Review++ grading
const grading = ref(false)
const graded = ref(false)
const lastSecondsSpent = ref(0)
const lastIsCorrect = ref(false)

const aiBusy = ref(false)
const aiError = ref('')
const aiExplanation = ref(null)

const startedAt = ref(Date.now())
let tick = null

const questions = computed(() => data.reviewQueue || [])
const dueCount = computed(() => questions.value.length)
const current = computed(() => questions.value[qIndex.value] || null)
const isDone = computed(() => dueCount.value > 0 && qIndex.value >= dueCount.value)

function resetPerQuestion() {
  selected.value = null
  reveal.value = false
  grading.value = false
  graded.value = false
  lastSecondsSpent.value = 0
  lastIsCorrect.value = false
  aiError.value = ''
  aiExplanation.value = null
  startedAt.value = Date.now()
}

watch(current, () => resetPerQuestion())

async function load() {
  loading.value = true
  error.value = ''
  try {
    await data.fetchReviewQueue({ limit: 30 })
    qIndex.value = 0
    resetPerQuestion()
  } catch (e) {
    error.value = e?.message || 'Failed to load review queue.'
  } finally {
    loading.value = false
  }
}

function backToPractice() {
  router.push('/practice')
}

function pick(i) {
  if (reveal.value) return
  selected.value = i
}

async function submit() {
  if (!current.value) return
  if (selected.value === null) return

  const secondsSpent = Math.max(0, Math.round((Date.now() - startedAt.value) / 1000))
  loading.value = true
  error.value = ''
  try {
    await data.submitAnswer({
      bankId: current.value.bankId,
      questionId: current.value.id,
      selectedIndex: selected.value,
      secondsSpent,
    })
    lastSecondsSpent.value = secondsSpent
    lastIsCorrect.value = selected.value === current.value.answerIndex
    reveal.value = true
  } catch (e) {
    error.value = e?.message || 'Failed to submit answer.'
  } finally {
    loading.value = false
  }
}

async function grade(rating) {
  if (!current.value) return
  if (!reveal.value) return
  if (grading.value || graded.value) return

  grading.value = true
  error.value = ''
  try {
    const out = await data.gradeReview({
      bankId: current.value.bankId,
      questionId: current.value.id,
      rating,
      isCorrect: lastIsCorrect.value,
      secondsSpent: lastSecondsSpent.value,
    })

    const sched = out?.schedule || null
    if (sched) {
      const nextIn = sched.rating === 'again' ? 'in ~10 mins' : `in ${sched.intervalDays} day(s)`
      toast(`Saved: ${String(sched.rating).toUpperCase()} • Next review ${nextIn}`, 'ok')
    } else {
      toast('Saved review grade.', 'ok')
    }

    // Remove this item from the local due list so the next question loads immediately.
    try {
      data.reviewQueue.splice(qIndex.value, 1)
    } catch (_) {
      // ignore
    }

    graded.value = true
  } catch (e) {
    error.value = e?.message || 'Failed to save grade.'
  } finally {
    grading.value = false
  }
}

function next() {
  if (qIndex.value < dueCount.value) qIndex.value += 1
}

async function explainWithAi() {
  if (!current.value) return
  aiBusy.value = true
  aiError.value = ''
  aiExplanation.value = null
  try {
    const res = await ai.explainMCQ({
      bankId: current.value.bankId,
      questionId: current.value.id,
    })
    aiExplanation.value = res?.data || null
  } catch (e) {
    aiError.value = e?.message || 'AI explanation failed.'
  } finally {
    aiBusy.value = false
  }
}

onMounted(async () => {
  await load()
  // lightweight tick so "seconds spent" feels alive (optional future UI)
  tick = window.setInterval(() => {}, 3000)
})

onUnmounted(() => {
  if (tick) window.clearInterval(tick)
})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Smart Review++</div>
          <p class="sub mt-1">
            Answer the question, then grade it (Again/Hard/Good/Easy) to control when you’ll see it next.
          </p>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="badge">Due now: {{ dueCount }}</span>
            <span v-if="data.progress?.dueReviews !== undefined" class="badge badge-soft">
              Total due: {{ data.progress.dueReviews }}
            </span>
          </div>
        </div>

        <div class="flex gap-2">
          <AppButton variant="ghost" @click="backToPractice">Back</AppButton>
          <AppButton variant="ghost" :disabled="loading" @click="load">Refresh</AppButton>
        </div>
      </div>
    </AppCard>

    <AppCard v-if="loading && !current" class="mt-3">
      <div class="skeleton h-24" />
      <div class="skeleton h-12 mt-2" />
      <div class="skeleton h-12 mt-2" />
    </AppCard>

    <AppCard v-else-if="error" class="mt-3">
      <div class="alert alert-warn" role="alert">{{ error }}</div>
    </AppCard>

    <AppCard v-else-if="dueCount === 0" class="mt-3">
      <div class="h2">Nothing due 🎉</div>
      <p class="sub mt-1">Come back later, or keep practicing to build your review queue.</p>
      <div class="mt-3">
        <AppButton @click="backToPractice">Go to Practice</AppButton>
      </div>
    </AppCard>

    <AppCard v-else-if="isDone" class="mt-3">
      <div class="h2">Review complete ✅</div>
      <p class="sub mt-1">Nice. Your next review items will appear when they’re due.</p>
      <div class="mt-3 flex gap-2">
        <AppButton @click="load">Reload</AppButton>
        <AppButton variant="ghost" @click="backToPractice">Back to Practice</AppButton>
      </div>
    </AppCard>

    <AppCard v-else-if="current" class="mt-3 relative">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="kicker">
          {{ current.courseCode }} • {{ current.bankTitle }}
        </div>
        <div class="badge badge-soft">Question {{ qIndex + 1 }} / {{ dueCount }}</div>
      </div>

      <div class="mt-1 text-lg sm:text-xl font-extrabold leading-snug">{{ current.prompt }}</div>

      <div class="mt-4 grid gap-2">
        <button
          v-for="(opt, i) in current.options"
          :key="i"
          type="button"
          class="card card-press card-pad text-left"
          :class="[
            selected === i ? 'ring-2 ring-accent/50' : '',
            reveal && i === current.answerIndex ? 'ring-2 ring-ok/40' : '',
            reveal && selected === i && i !== current.answerIndex ? 'ring-2 ring-danger/50' : '',
          ]"
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

      <div class="mt-4 flex flex-col sm:flex-row gap-2">
        <AppButton v-if="!reveal" :disabled="loading || selected === null" @click="submit">
          Submit
        </AppButton>
        <AppButton variant="ghost" :disabled="aiBusy" @click="explainWithAi">
          <span v-if="!aiBusy">Explain with AI</span>
          <span v-else>Thinking…</span>
        </AppButton>
      </div>

      <div v-if="reveal" class="mt-4">
        <div class="text-sm font-semibold">Grade this review</div>
        <div class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <AppButton variant="danger" :disabled="grading" @click="grade('again')">Again</AppButton>
          <AppButton variant="ghost" :disabled="grading" @click="grade('hard')">Hard</AppButton>
          <AppButton :disabled="grading" @click="grade('good')">Good</AppButton>
          <AppButton :disabled="grading" @click="grade('easy')">Easy</AppButton>
        </div>
        <p class="sub mt-2">Tip: choose “Again” if you had to guess. “Easy” schedules it further away.</p>
      </div>

      <div v-if="reveal && current.explanation" class="alert alert-ok mt-4" role="status">
        <div class="font-semibold">Explanation</div>
        <div class="mt-1 text-sm text-text-2">{{ current.explanation }}</div>
      </div>

      <div v-if="aiError" class="alert alert-warn mt-4" role="alert">{{ aiError }}</div>

      <div v-else-if="aiExplanation" class="alert alert-ok mt-4" role="status">
        <div class="font-semibold">AI explanation</div>
        <div v-if="aiExplanation.explanation" class="mt-1 text-sm text-text-2">{{ aiExplanation.explanation }}</div>

        <ul v-if="aiExplanation.steps?.length" class="mt-2 text-sm text-text-2 list-disc pl-5">
          <li v-for="(s, i) in aiExplanation.steps" :key="i">{{ s }}</li>
        </ul>

        <ul v-if="aiExplanation.whyOthersAreWrong?.length" class="mt-2 text-sm text-text-2 list-disc pl-5">
          <li v-for="(s, i) in aiExplanation.whyOthersAreWrong" :key="'w'+i">{{ s }}</li>
        </ul>
      </div>
    </AppCard>
  </div>
</template>
