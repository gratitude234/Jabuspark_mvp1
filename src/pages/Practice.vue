<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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

watch(bankId, async (id) => {
  if (!id) return
  qIndex.value = 0
  selected.value = null
  reveal.value = false
  await load(id)
})

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
    const res = await data.submitAnswer({
      bankId: bankId.value,
      questionId: current.value.id,
      selectedIndex: selected.value,
      secondsSpent: 0
    })

    reveal.value = true

    // If API returned isCorrect, we can show a toast someday; for now just keep UI.
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
    <AppCard>
      <div class="flex flex-col gap-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="kicker">Practice bank</div>
            <div class="h1 mt-1 truncate">{{ bank?.title || 'Loading…' }}</div>
            <p class="sub mt-2">Answer, reveal, then move fast. Keep it focused.</p>
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

        <div class="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div class="h-full bg-accent transition-all duration-200" :style="{ width: progressPct + '%' }" />
        </div>

        <div v-if="content.loading.bank" class="grid gap-2">
          <div class="skeleton h-24" />
          <div class="skeleton h-12" />
          <div class="skeleton h-12" />
        </div>

        <div v-else-if="error" class="alert alert-warn" role="alert">{{ error }}</div>
      </div>
    </AppCard>

    <AppCard v-if="!content.loading.bank && current" class="relative">
      <div class="kicker">Question {{ qIndex + 1 }}</div>
      <div class="mt-1 text-lg sm:text-xl font-extrabold leading-snug">{{ current.question }}</div>

      <div class="mt-4 grid gap-2">
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
          @click="pick(i)"
        >
          <div class="flex items-start gap-3">
            <div class="mt-0.5 h-6 w-6 rounded-full border border-stroke/60 grid place-items-center text-xs font-bold">
              {{ String.fromCharCode(65 + i) }}
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-text">{{ opt }}</div>
              <div v-if="reveal && i === current.answerIndex" class="text-xs text-text-2 mt-1">Correct answer</div>
              <div v-else-if="reveal && selected === i && i !== current.answerIndex" class="text-xs text-danger mt-1">Your choice</div>
            </div>
          </div>
        </button>
      </div>

      <div v-if="reveal" class="mt-4 alert alert-ok" role="status">
        <div class="font-semibold">Explanation</div>
        <div class="mt-1 text-sm text-text-2">{{ current.explanation || 'No explanation provided yet.' }}</div>
      </div>

      <div class="mt-5 flex flex-col sm:flex-row gap-2">
        <AppButton
          v-if="!reveal"
          class="w-full sm:w-auto"
          :disabled="busy || selected === null"
          @click="submit"
        >
          <span v-if="!busy">Reveal answer</span>
          <span v-else>Submitting…</span>
        </AppButton>

        <AppButton
          v-else
          class="w-full sm:w-auto"
          :disabled="qIndex >= questions.length - 1"
          @click="next"
        >
          Next question
        </AppButton>

        <button class="btn btn-ghost w-full sm:w-auto" @click="backToBanks">Back to banks</button>
      </div>
    </AppCard>

    <AppCard v-else-if="!content.loading.bank" class="alert alert-ok" role="status">
      No questions to practice right now.
    </AppCard>
  </div>
</template>
