<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/data'
import { useAiStore } from '../stores/ai'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const data = useDataStore()
const ai = useAiStore()

const loading = ref(false)
const error = ref('')
const qIndex = ref(0)
const selected = ref(null)
const reveal = ref(false)

const aiBusy = ref(false)
const aiError = ref('')
const aiExplanation = ref(null)

const startedAt = ref(Date.now())

const dueCount = computed(() => (data.reviewQueue || []).length)
const current = computed(() => (data.reviewQueue || [])[qIndex.value] || null)
const isDone = computed(() => qIndex.value >= dueCount.value && dueCount.value > 0)

function resetPerQuestion() {
  selected.value = null
  reveal.value = false
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
    reveal.value = true
  } catch (e) {
    error.value = e?.message || 'Failed to submit answer.'
  } finally {
    loading.value = false
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

function backToPractice() {
  router.push('/practice')
}

onMounted(async () => {
  await load()
  // lightweight tick so "seconds spent" isn't always 0 on immediate clicks
  startedAt.value = Date.now()
})

onUnmounted(() => {})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Smart Review</div>
          <p class="sub mt-1">
            Review questions you previously missed. The system schedules the next time you’ll see each question.
          </p>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="badge">Due now: {{ dueCount }}</span>
            <span v-if="data.progress?.dueReviews !== undefined" class="badge badge-soft">
              Total due: {{ data.progress.dueReviews }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button class="btn btn-ghost btn-sm" @click="backToPractice">Practice</button>
          <button class="btn btn-ghost btn-sm" :disabled="loading" @click="load">Refresh</button>
        </div>
      </div>

      <div class="mt-4 panel p-4">
        <div class="flex items-center justify-between text-xs text-text-3">
          <span>Session progress</span>
          <span class="font-semibold text-text">
            {{ dueCount ? Math.min(100, Math.round(((qIndex + 1) / dueCount) * 100)) : 0 }}%
          </span>
        </div>
        <div class="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            class="h-full bg-accent/70"
            :style="{ width: (dueCount ? Math.min(100, Math.round(((qIndex + 1) / dueCount) * 100)) : 0) + '%' }"
          />
        </div>
      </div>
    </AppCard>

    <AppCard v-if="loading" class="mt-3 skeleton">Loading review…</AppCard>

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
      <p class="sub mt-1">Nice. Your next reviews will appear as they become due.</p>
      <div class="mt-3 flex gap-2">
        <AppButton @click="backToPractice">Continue practicing</AppButton>
        <AppButton variant="ghost" @click="load">Reload</AppButton>
      </div>
    </AppCard>

    <AppCard v-else-if="current" class="mt-3 relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
      <div class="relative">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="kicker">
            {{ current.courseCode }} • {{ current.bankTitle }}
          </div>
          <div class="badge badge-soft">Question {{ qIndex + 1 }} / {{ dueCount }}</div>
        </div>

        <div class="mt-2 panel p-4">
          <div class="kicker">Question</div>
          <div class="mt-1 text-lg sm:text-xl font-extrabold leading-snug whitespace-pre-line">
            {{ current.prompt || current.question || '' }}
          </div>
        </div>

        <div class="mt-4 grid gap-2" role="radiogroup" aria-label="Answer options">
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
            :disabled="reveal"
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

        <div class="mt-4 panel p-4">
          <div class="flex flex-col sm:flex-row gap-2">
            <AppButton class="w-full sm:w-auto" :disabled="loading || selected === null || reveal" @click="submit">
              Submit
            </AppButton>

            <AppButton v-if="reveal" class="w-full sm:w-auto" variant="ghost" @click="next">
              Next
            </AppButton>

            <AppButton v-else class="w-full sm:w-auto" variant="ghost" :disabled="aiBusy" @click="explainWithAi">
              <span v-if="!aiBusy">Explain with AI</span>
              <span v-else>Thinking…</span>
            </AppButton>
          </div>

          <p class="help mt-2">After you submit, the system schedules this question for future review.</p>

          <div v-if="aiError" class="alert alert-warn mt-3" role="alert">{{ aiError }}</div>
        </div>

        <div v-if="reveal && current.explanation" class="alert alert-ok mt-4" role="status">
          <div class="font-semibold">Explanation</div>
          <div class="mt-1 text-sm text-text-2">{{ current.explanation }}</div>
        </div>

        <div v-if="aiExplanation" class="alert alert-ok mt-3" role="status">
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
    </AppCard>
  </div>
</template>
