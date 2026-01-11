<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppCard from '../components/AppCard.vue'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import { toast } from '../utils/toast'

const props = defineProps({
  bankId: { type: String, required: true },
})

const router = useRouter()
const content = useContentStore()
const data = useDataStore()

const bank = computed(() => content.bank || null)
const isTheoryBank = computed(() => String(bank.value?.mode || '').toLowerCase() === 'theory')
const questions = computed(() => bank.value?.questions || [])
const total = computed(() => questions.value.length)

const loading = ref(true)
const error = ref('')

const idx = ref(0)
const answerText = ref('')
const selfScore = ref(0)
const aiGrade = ref(true)
const lastAi = ref(null)
const showGuide = ref(false)
const saving = ref(false)

const startedAt = ref(Date.now())

const attempts = computed(() => data.theoryAttempts?.[props.bankId] || [])
const latestByQuestion = computed(() => data.theoryLatest?.[props.bankId] || {})

const current = computed(() => questions.value[idx.value] || null)
const currentLatest = computed(() => {
  const qid = String(current.value?.id || '')
  return qid ? latestByQuestion.value?.[qid] || null : null
})

const attemptedCount = computed(() => Object.keys(latestByQuestion.value || {}).length)
const completionPct = computed(() => (total.value ? Math.round((attemptedCount.value / total.value) * 100) : 0))

const attemptsForCurrent = computed(() => {
  const qid = String(current.value?.id || '')
  if (!qid) return []
  return attempts.value.filter((a) => String(a.questionId) === qid)
})

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts || '')
  }
}

watch(
  () => [props.bankId, idx.value, currentLatest.value?.attemptId],
  () => {
    startedAt.value = Date.now()
    showGuide.value = false
    error.value = ''

    // Prefill from latest saved attempt (optional)
    answerText.value = currentLatest.value?.answerText || ''
    selfScore.value = Number(currentLatest.value?.selfScore ?? 0)
  },
  { immediate: true }
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await Promise.allSettled([
      content.fetchBank(props.bankId),
      data.fetchTheoryAttempts({ bankId: props.bankId }),
    ])

    // If it's not a theory bank, we still show the page but with a clear message
    if (!isTheoryBank.value) {
      error.value = 'This bank is not a theory bank.'
    }
  } catch (e) {
    error.value = e?.message || 'Failed to load theory bank'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function prev() {
  if (idx.value > 0) idx.value -= 1
}

function next() {
  if (idx.value < total.value - 1) idx.value += 1
}

async function saveAttempt() {
  if (!current.value?.id) return

  const txt = String(answerText.value || '').trim()
  if (!txt) {
    toast('Write an answer first.', 'warn')
    return
  }

  const secondsSpent = Math.max(0, Math.round((Date.now() - startedAt.value) / 1000))

  saving.value = true
  try {
    const res = await data.submitTheoryAttempt({
      bankId: props.bankId,
      questionId: String(current.value.id),
      answerText: txt,
      selfScore: aiGrade.value ? null : Number(selfScore.value || 0),
      secondsSpent,
      aiGrade: Boolean(aiGrade.value),
    })

    lastAi.value = res?.result?.ai || null

    // Refresh attempts so we get server timestamps
    await data.fetchTheoryAttempts({ bankId: props.bankId })

    toast('Saved.', 'ok')
  } catch (e) {
    toast(e?.message || 'Failed to save attempt', 'warn')
  } finally {
    saving.value = false
  }
}

async function resetBank() {
  if (!confirm('Reset your theory attempts for this bank?')) return
  try {
    await data.resetTheoryBank(props.bankId)
    answerText.value = ''
    selfScore.value = 0
    lastAi.value = null
    showGuide.value = false
    toast('Reset complete.', 'ok')
  } catch (e) {
    toast(e?.message || 'Failed to reset', 'warn')
  }
}
</script>

<template>
  <div class="page pb-28 space-y-3">
    <AppCard>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Theory Practice</div>
          <p class="sub mt-1">
            <span v-if="bank?.title">{{ bank.title }}</span>
            <span v-else>Loading…</span>
          </p>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="chip">{{ attemptedCount }} / {{ total }} attempted</span>
            <span class="chip">{{ completionPct }}% done</span>
            <span class="chip">Streak: {{ data.progress?.streak ?? 0 }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <button class="btn btn-ghost btn-sm h-11" @click="router.push('/practice?tab=theory')">All Theory Banks</button>
          <button class="btn btn-ghost btn-sm h-11" :disabled="saving" @click="resetBank">Reset</button>
        </div>
      </div>

      <div v-if="error" class="alert alert-warn mt-4" role="alert">{{ error }}</div>
      <div v-if="!loading && !isTheoryBank" class="help mt-2">
        Tip: open this bank from <b>Practice → Theory</b>, or convert the bank mode to <code>theory</code>.
      </div>
    </AppCard>

    <AppCard v-if="loading">
      <div class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <AppCard v-else-if="!current">
      <div class="h2">No questions</div>
      <p class="sub mt-1">This theory bank has no questions yet.</p>
    </AppCard>

    <AppCard v-else>
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-semibold">Question {{ idx + 1 }} / {{ total }}</div>
        <div class="text-xs text-text-3" v-if="currentLatest">
          Last saved: {{ fmt(currentLatest.createdAt) }}
          <span v-if="currentLatest.selfScore !== null"> • Score {{ currentLatest.selfScore }}/5</span>
        </div>
      </div>

      <div class="mt-3 text-base font-extrabold leading-snug whitespace-pre-line">{{ current.prompt }}</div>

      <div class="mt-4">
        <label class="label" for="answer">Your answer</label>
        <textarea
          id="answer"
          v-model="answerText"
          rows="8"
          class="input w-full"
          placeholder="Write your theory answer here..."
        />
      </div>

      <div class="mt-3 grid gap-2 sm:flex sm:items-end sm:justify-between">
        <div class="w-full sm:w-[220px]">
          <label class="label" for="score">Self score (0 to 5)</label>
          <select id="score" v-model="selfScore" class="input h-11" :disabled="aiGrade">
            <option :value="0">0</option>
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="4">4</option>
            <option :value="5">5</option>
          </select>
        </div>

        <div class="w-full sm:w-[260px]">
          <label class="label flex items-center gap-2" for="aiGrade">
            <input id="aiGrade" type="checkbox" v-model="aiGrade" />
            <span>Grade with AI</span>
          </label>
          <div class="text-xs text-text-3">If enabled, we will generate an AI score and feedback.</div>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button class="btn btn-ghost btn-sm h-11 w-full sm:w-auto" @click="showGuide = !showGuide">
            {{ showGuide ? 'Hide guide' : 'Reveal guide' }}
          </button>

          <button class="btn btn-primary btn-sm h-11 w-full sm:w-auto" :disabled="saving" @click="saveAttempt">
            {{ saving ? 'Saving...' : 'Save attempt' }}
          </button>
        </div>
      </div>

      <div v-if="showGuide" class="mt-4 card card-pad">
        <div class="text-sm font-semibold">Model guide</div>
        <div v-if="current.guide" class="mt-2 whitespace-pre-line text-sm">{{ current.guide }}</div>
        <div v-else class="mt-2 text-sm text-text-3">No model guide provided for this question.</div>

        <div v-if="Array.isArray(current.points) && current.points.length" class="mt-3">
          <div class="text-xs font-semibold text-text-2">Key points</div>
          <ul class="mt-2 list-disc pl-5 text-sm">
            <li v-for="(p, i) in current.points" :key="i">{{ p }}</li>
          </ul>
        </div>
      </div>


      <div v-if="(currentLatest && currentLatest.aiScore !== null) || (lastAi && lastAi.score !== undefined)" class="mt-4 card card-pad">
        <div class="text-sm font-semibold">AI grade</div>
        <div class="mt-2 text-sm">
          <span class="font-semibold">Score:</span>
          {{ (lastAi && typeof lastAi.score === 'number') ? lastAi.score : currentLatest.aiScore }}/5
        </div>
        <div v-if="(lastAi && lastAi.feedback) || (currentLatest && currentLatest.aiFeedback)" class="mt-2 whitespace-pre-line text-sm">
          {{ (lastAi && lastAi.feedback) ? lastAi.feedback : currentLatest.aiFeedback }}
        </div>
        <div v-if="lastAi && lastAi.error" class="mt-2 text-sm text-red-600">{{ lastAi.error }}</div>
      </div>


      <div v-if="attemptsForCurrent.length" class="mt-4">
        <div class="text-xs font-semibold text-text-2">Your recent attempts</div>
        <div class="mt-2 grid gap-2">
          <div v-for="a in attemptsForCurrent.slice(0, 3)" :key="a.attemptId" class="card card-pad">
            <div class="flex items-center justify-between text-xs text-text-3">
              <span>{{ fmt(a.createdAt) }}</span>
              <span v-if="a.aiScore !== null || a.selfScore !== null">Score {{ (a.aiScore !== null ? a.aiScore : a.selfScore) }}/5</span>
            </div>
            <div class="mt-2 whitespace-pre-line text-sm">{{ a.answerText }}</div>
          </div>
        </div>
      </div>

      <div class="mt-5 flex items-center justify-between gap-2">
        <button class="btn btn-ghost btn-sm h-11" :disabled="idx === 0" @click="prev">Prev</button>
        <button class="btn btn-ghost btn-sm h-11" :disabled="idx >= total - 1" @click="next">Next</button>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
.chip {
  padding: 0.35rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  line-height: 1rem;
  background: rgba(0, 0, 0, 0.06);
}
</style>
