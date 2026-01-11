<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import { useAiStore } from '../stores/ai'
import AppCard from '../components/AppCard.vue'
import ProgressBar from '../components/ProgressBar.vue'

const route = useRoute()
const router = useRouter()
const content = useContentStore()
const dataStore = useDataStore()
const ai = useAiStore()

const bankId = ref('')
const idx = ref(0)
const answerText = ref('')
const selfScore = ref(null)
const showGuide = ref(false)
const saving = ref(false)
const error = ref('')
const startedAt = ref(Date.now())

// AI coach state
const includeAiScore = ref(true)
const aiHint = ref(null)
const aiFeedback = ref(null)
const aiCoachBusy = ref(false)
const aiCoachErr = ref('')

const bank = computed(() => content.bank)
const questions = computed(() => bank.value?.questions || [])
const total = computed(() => questions.value.length)
const current = computed(() => questions.value[idx.value] || null)
const progress = computed(() => (total.value ? Math.round(((idx.value + 1) / total.value) * 100) : 0))

const guideText = computed(() => current.value?.guide || '')
const points = computed(() => current.value?.points || [])

// Latest saved attempt for this question (used to optionally attach AI feedback)
const latestAttempt = computed(() => {
  const b = String(bankId.value || '')
  const q = String(current.value?.id || '')
  if (!b || !q) return null
  return dataStore.theoryLatest?.[b]?.[q] || null
})

const canNext = computed(() => idx.value < total.value - 1)
const canPrev = computed(() => idx.value > 0)

function resetStateForQuestion() {
  answerText.value = ''
  selfScore.value = null
  showGuide.value = false
  error.value = ''
  startedAt.value = Date.now()

  // Reset AI for new question
  aiHint.value = null
  aiFeedback.value = null
  aiCoachErr.value = ''
  aiCoachBusy.value = false
}

async function load() {
  bankId.value = String(route.params.bankId || '')
  if (!bankId.value) return router.push('/practice')

  await content.fetchBank(bankId.value)

  // Guard: non-theory banks
  const mode = String(content.bank?.mode || '').toLowerCase()
  if (mode !== 'theory') {
    return router.push(`/practice/${encodeURIComponent(bankId.value)}`)
  }

  // Load most recent index (based on attempts)
  try {
    const a = await dataStore.fetchTheoryAttempts(bankId.value)
    // a is an array; we can decide last attempted question
    // The store returns attempts (newest first). Find last question id.
    const lastQ = Array.isArray(a) && a.length ? a[0]?.questionId : null
    if (lastQ) {
      const i = questions.value.findIndex(q => String(q.id) === String(lastQ))
      if (i >= 0) idx.value = i
    }
  } catch (e) {
    // ignore
  }

  resetStateForQuestion()
}

function next() {
  if (!canNext.value) return
  idx.value++
  resetStateForQuestion()
}

function prev() {
  if (!canPrev.value) return
  idx.value--
  resetStateForQuestion()
}

async function saveAttempt() {
  error.value = ''

  const q = current.value
  if (!q) return

  const a = (answerText.value || '').trim()
  if (!a) {
    error.value = 'Write your answer first.'
    return
  }

  saving.value = true
  try {
    const secondsSpent = Math.max(0, Math.round((Date.now() - startedAt.value) / 1000))
    await dataStore.submitTheoryAttempt({
      bankId: bankId.value,
      questionId: q.id,
      answerText: a,
      selfScore: selfScore.value,
      secondsSpent,
    })

    // Move on
    if (canNext.value) {
      idx.value++
      resetStateForQuestion()
    }
  } catch (e) {
    error.value = e?.message || 'Failed to save attempt.'
  } finally {
    saving.value = false
  }
}

async function getAiHint() {
  aiCoachErr.value = ''
  aiHint.value = null
  aiCoachBusy.value = true

  const q = current.value
  if (!q) {
    aiCoachErr.value = 'No question loaded.'
    aiCoachBusy.value = false
    return
  }

  try {
    const out = await ai.theoryCoach({
      bankId: bankId.value,
      questionId: q.id,
      mode: 'hint',
    })
    aiHint.value = out?.hint || null
  } catch (e) {
    aiCoachErr.value = e?.message || 'AI hint failed.'
  } finally {
    aiCoachBusy.value = false
  }
}

async function getAiFeedback() {
  aiCoachErr.value = ''
  aiFeedback.value = null
  aiCoachBusy.value = true

  const q = current.value
  if (!q) {
    aiCoachErr.value = 'No question loaded.'
    aiCoachBusy.value = false
    return
  }

  const a = (answerText.value || '').trim()
  if (!a) {
    aiCoachErr.value = 'Write your answer first, then request feedback.'
    aiCoachBusy.value = false
    return
  }

  try {
    const out = await ai.theoryCoach({
      bankId: bankId.value,
      questionId: q.id,
      mode: 'feedback',
      answerText: a,
      includeScore: includeAiScore.value,
      attemptId: (latestAttempt.value && String((latestAttempt.value.answerText || '').trim()) === a)
        ? latestAttempt.value.attemptId
        : '',
    })
    aiFeedback.value = out?.feedback || null
  } catch (e) {
    aiCoachErr.value = e?.message || 'AI feedback failed.'
  } finally {
    aiCoachBusy.value = false
  }
}

onMounted(load)
watch(() => route.params.bankId, load)
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="h1">Theory Practice</div>
          <p class="sub mt-1">Write your answer, then self-mark with the guide. Optional AI coach can give hints + feedback.</p>
        </div>
        <button class="btn btn-ghost btn-sm" @click="router.push('/practice')">Back</button>
      </div>

      <div class="divider my-4" />

      <div v-if="!bank" class="sub">Loading…</div>

      <div v-else>
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">{{ bank.title }}</div>
            <div class="text-xs text-text-3">Question {{ idx + 1 }} of {{ total }}</div>
          </div>
          <div class="w-40">
            <ProgressBar :value="progress" />
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <!-- Left: prompt + answer -->
          <div>
            <div class="card card-pad">
              <div class="text-xs font-semibold opacity-80">Prompt</div>
              <div class="mt-2 whitespace-pre-line text-sm">{{ current?.prompt }}</div>

              <div class="divider my-4" />

              <div class="text-xs font-semibold opacity-80">Your answer</div>
              <textarea
                v-model="answerText"
                class="input mt-2 min-h-[220px] resize-y"
                placeholder="Write your answer here…"
              />

              <div class="mt-3 flex items-center justify-between gap-2">
                <button class="btn btn-ghost btn-sm" :disabled="!canPrev" @click="prev">Prev</button>
                <button class="btn btn-ghost btn-sm" :disabled="!canNext" @click="next">Next</button>
              </div>
            </div>

            <div v-if="showGuide" class="card card-pad mt-3">
              <div class="text-xs font-semibold opacity-80">Marking guide</div>
              <div v-if="guideText" class="mt-2 whitespace-pre-line text-sm">{{ guideText }}</div>
              <div v-if="points && points.length" class="mt-3">
                <div class="text-xs font-semibold opacity-80">Key points</div>
                <ul class="mt-2 list-disc pl-5 text-sm">
                  <li v-for="(p, i) in points" :key="i">{{ p }}</li>
                </ul>
              </div>
              <div v-if="!guideText && (!points || !points.length)" class="mt-2 text-sm text-text-2">
                No guide/points provided for this question yet.
              </div>
            </div>
          </div>

          <!-- Right: self score + AI coach -->
          <div>
            <div class="card card-pad">
              <div class="text-xs font-semibold opacity-80">Self score (0–5)</div>
              <p class="sub mt-1">After you reveal the guide, score yourself honestly. This helps you track progress.</p>

              <div class="mt-3">
                <select v-model="selfScore" class="input">
                  <option :value="null">Not scored</option>
                  <option :value="0">0 — blank / totally wrong</option>
                  <option :value="1">1 — very weak</option>
                  <option :value="2">2 — some correct points</option>
                  <option :value="3">3 — decent</option>
                  <option :value="4">4 — very good</option>
                  <option :value="5">5 — excellent</option>
                </select>
              </div>

              <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button class="btn btn-ghost btn-sm" :disabled="aiCoachBusy" @click="getAiHint">
                  <span v-if="!aiCoachBusy">AI hint</span>
                  <span v-else>…</span>
                </button>
                <button class="btn btn-ghost btn-sm" :disabled="aiCoachBusy" @click="getAiFeedback">
                  <span v-if="!aiCoachBusy">AI feedback</span>
                  <span v-else>…</span>
                </button>
                <button class="btn btn-ghost btn-sm" @click="showGuide = !showGuide">
                  {{ showGuide ? 'Hide guide' : 'Reveal guide' }}
                </button>
                <button class="btn btn-sm" :disabled="saving" @click="saveAttempt">
                  <span v-if="!saving">Save attempt</span>
                  <span v-else>Saving…</span>
                </button>
              </div>

              <div class="mt-3 flex items-center justify-between gap-2">
                <label class="flex items-center gap-2 text-xs opacity-80">
                  <input type="checkbox" v-model="includeAiScore" />
                  Include AI score (0–5)
                </label>
                <div v-if="ai.loading.theoryCoach" class="text-xs opacity-70">AI is thinking…</div>
              </div>

              <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>

              <div v-if="aiCoachErr" class="alert alert-danger mt-4" role="alert">{{ aiCoachErr }}</div>
            </div>

            <div v-if="aiHint || aiFeedback" class="card card-pad mt-3">
              <div class="flex items-center justify-between gap-2">
                <div class="text-sm font-semibold">AI Coach</div>
                <div class="text-xs opacity-70">Hints + feedback (may be imperfect)</div>
              </div>

              <div v-if="aiHint" class="mt-3">
                <div class="text-xs font-semibold opacity-80">Hint outline</div>
                <ul v-if="aiHint.outline?.length" class="mt-2 list-disc pl-5 text-sm">
                  <li v-for="(p, i) in aiHint.outline" :key="'o'+i">{{ p }}</li>
                </ul>

                <div v-if="aiHint.keyPoints?.length" class="mt-3">
                  <div class="text-xs font-semibold opacity-80">Key points to cover</div>
                  <ul class="mt-2 list-disc pl-5 text-sm">
                    <li v-for="(p, i) in aiHint.keyPoints" :key="'k'+i">{{ p }}</li>
                  </ul>
                </div>

                <div v-if="aiHint.commonMistakes?.length" class="mt-3">
                  <div class="text-xs font-semibold opacity-80">Common mistakes</div>
                  <ul class="mt-2 list-disc pl-5 text-sm">
                    <li v-for="(p, i) in aiHint.commonMistakes" :key="'m'+i">{{ p }}</li>
                  </ul>
                </div>

                <div v-if="aiHint.firstSentence" class="mt-3">
                  <div class="text-xs font-semibold opacity-80">Suggested first sentence</div>
                  <div class="mt-1 text-sm whitespace-pre-line">{{ aiHint.firstSentence }}</div>
                </div>
              </div>

              <div v-if="aiFeedback" class="mt-4">
                <div class="divider my-3" />

                <div class="flex items-center justify-between gap-2">
                  <div class="text-xs font-semibold opacity-80">Feedback</div>
                  <div v-if="aiFeedback.score !== null && aiFeedback.score !== undefined" class="text-xs opacity-80">
                    AI score: <span class="font-semibold">{{ aiFeedback.score }}/5</span>
                  </div>
                </div>

                <div v-if="aiFeedback.strengths?.length" class="mt-2">
                  <div class="text-xs font-semibold opacity-80">What you did well</div>
                  <ul class="mt-2 list-disc pl-5 text-sm">
                    <li v-for="(p, i) in aiFeedback.strengths" :key="'s'+i">{{ p }}</li>
                  </ul>
                </div>

                <div v-if="aiFeedback.missingPoints?.length" class="mt-3">
                  <div class="text-xs font-semibold opacity-80">Missing / weak points</div>
                  <ul class="mt-2 list-disc pl-5 text-sm">
                    <li v-for="(p, i) in aiFeedback.missingPoints" :key="'mp'+i">{{ p }}</li>
                  </ul>
                </div>

                <div v-if="aiFeedback.improvements?.length" class="mt-3">
                  <div class="text-xs font-semibold opacity-80">How to improve</div>
                  <ul class="mt-2 list-disc pl-5 text-sm">
                    <li v-for="(p, i) in aiFeedback.improvements" :key="'im'+i">{{ p }}</li>
                  </ul>
                </div>

                <div v-if="aiFeedback.rewriteSuggestion" class="mt-3">
                  <div class="text-xs font-semibold opacity-80">Suggested rewrite (structure)</div>
                  <div class="mt-1 whitespace-pre-line text-sm">{{ aiFeedback.rewriteSuggestion }}</div>
                </div>
              </div>

              <div class="mt-3 sub">
                Note: AI feedback is a guide, not the final authority. Always cross-check with your lecturer’s notes and marking scheme.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
