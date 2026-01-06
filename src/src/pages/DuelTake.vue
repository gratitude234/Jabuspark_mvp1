<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'
import { toast } from '../utils/toast'

const route = useRoute()
const router = useRouter()
const data = useDataStore()

const code = computed(() => String(route.params.code || '').trim())

const loading = ref(true)
const error = ref('')
const questions = ref([])
const qIndex = ref(0)
const answers = ref({}) // { [qid]: selectedIndex }

const remaining = ref(0)
let timer = null
const startedAt = ref(Date.now())

const duel = computed(() => data.duel?.duel || null)

const current = computed(() => questions.value[qIndex.value] || null)
const total = computed(() => questions.value.length || 0)

const elapsedSeconds = computed(() => Math.max(0, Math.floor((Date.now() - startedAt.value) / 1000)))

function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function pick(idx) {
  if (!current.value) return
  answers.value = { ...answers.value, [current.value.id]: idx }
}

function next() {
  if (qIndex.value < total.value - 1) qIndex.value += 1
}

function prev() {
  if (qIndex.value > 0) qIndex.value -= 1
}

async function submit() {
  if (!code.value) return
  loading.value = true
  try {
    const res = await data.submitDuel({
      code: code.value,
      answers: answers.value,
      secondsTotal: elapsedSeconds.value,
    })
    toast(`Submitted (${res?.score ?? 0}/${res?.total ?? total.value})`, 'ok')
    router.push(`/duel/${code.value}/result`)
  } catch (e) {
    error.value = e?.message || 'Failed to submit'
  } finally {
    loading.value = false
  }
}

function startTimer(initialSeconds) {
  remaining.value = Math.max(0, Number(initialSeconds || 0))
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1)
    if (remaining.value <= 0) {
      clearInterval(timer)
      timer = null
      // auto-submit when time runs out
      submit()
    }
  }, 1000)
}

onMounted(async () => {
  error.value = ''
  loading.value = true
  try {
    // Ensure I'm joined (side effect) then fetch questions (read-only)
    const joined = await data.joinDuel(code.value)
    if (joined?.duel?.status !== 'live') {
      router.replace(`/duel/${code.value}`)
      return
    }
    const res = await data.getDuelQuestions(code.value)
    if (res?.duel?.status !== 'live') {
      router.replace(`/duel/${code.value}`)
      return
    }
    questions.value = res?.questions || []
    if (!questions.value.length) {
      router.replace(`/duel/${code.value}`)
      return
    }
    startedAt.value = Date.now()
    startTimer(res?.duel?.remainingSeconds ?? res?.duel?.durationMins * 60)
  } catch (e) {
    error.value = e?.message || 'Failed to start duel'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  timer = null
})
</script>

<template>
  <div class="page">
    <AppCard class="max-w-3xl mx-auto">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xs text-text-3">1v1 Duel</div>
          <div class="h1 mt-1">{{ duel?.bankTitle || 'Duel' }}</div>
          <div class="sub mt-1">Time left: <b>{{ fmt(remaining) }}</b></div>
        </div>

        <div class="text-right">
          <div class="text-sm font-semibold">{{ qIndex + 1 }} / {{ total }}</div>
          <div class="text-xs text-text-3">Code: {{ code }}</div>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger mt-4">{{ error }}</div>

      <div v-if="loading" class="mt-6 grid gap-2" role="status" aria-live="polite">
        <div class="skeleton h-4 w-32" />
        <div class="skeleton h-14" />
        <div class="skeleton h-12" />
        <div class="skeleton h-12" />
      </div>

      <div v-else class="mt-6">
        <div class="text-sm text-text-3">Question {{ qIndex + 1 }}</div>
        <div class="text-lg font-semibold mt-1">{{ current?.prompt }}</div>

        <div class="mt-4 grid gap-2">
          <button
            v-for="(opt, idx) in (current?.options || [])"
            :key="idx"
            type="button"
            class="card card-press card-pad text-left flex gap-3 items-start"
            :class="answers[current?.id] === idx ? 'ring-1 ring-accent/40 bg-white/[0.05]' : ''"
            @click="pick(idx)"
          >
            <span
              class="h-7 w-7 rounded-lg bg-white/[0.04] border border-stroke/60 grid place-items-center text-xs font-extrabold text-text-2 shrink-0"
              aria-hidden="true"
            >
              {{ String.fromCharCode(65 + idx) }}
            </span>
            <span class="text-sm leading-relaxed">{{ opt }}</span>
          </button>
        </div>

        <div class="mt-6 flex flex-wrap gap-2 justify-between">
          <div class="flex gap-2">
            <AppButton variant="outline" :disabled="qIndex === 0" @click="prev">Prev</AppButton>
            <AppButton variant="outline" :disabled="qIndex >= total - 1" @click="next">Next</AppButton>
          </div>

          <div class="flex gap-2">
            <AppButton variant="ghost" @click="router.push(`/duel/${code}`)">Lobby</AppButton>
            <AppButton :disabled="loading" @click="submit">Submit</AppButton>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
