<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'

const route = useRoute()
const router = useRouter()
const data = useDataStore()

const examId = computed(() => route.params.examId)

const loading = ref(false)
const error = ref('')
const qIndex = ref(0)
const answers = ref({}) // { [qid]: selectedIndex }
const flagged = ref(new Set())

const startedAtMs = ref(Date.now())
const remaining = ref(0)
let timer = null

const exam = computed(() => data.exam?.exam || null)
const questions = computed(() => data.exam?.questions || [])
const current = computed(() => questions.value[qIndex.value] || null)

function setupTimer() {
  if (timer) window.clearInterval(timer)
  timer = null
  const mins = Number(exam.value?.durationMins || 60)
  remaining.value = Math.max(60, Math.round(mins * 60))
  startedAtMs.value = Date.now()
  timer = window.setInterval(async () => {
    remaining.value -= 1
    if (remaining.value <= 0) {
      remaining.value = 0
      window.clearInterval(timer)
      timer = null
      await submit(true)
    }
  }, 1000)
}

function fmtRemain() {
  const s = Math.max(0, Number(remaining.value || 0))
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    // if store doesn't have this exam, fetch from API
    if (!data.exam?.exam || String(data.exam.exam.id) !== String(examId.value)) {
      await data.getExam(examId.value)
    }
    // Init timer once we have exam meta
    setupTimer()
  } catch (e) {
    error.value = e?.message || 'Failed to load exam'
  } finally {
    loading.value = false
  }
}

onMounted(load)
onUnmounted(() => { if (timer) window.clearInterval(timer) })

watch(examId, () => {
  qIndex.value = 0
  answers.value = {}
  flagged.value = new Set()
  load()
})

function pick(i) {
  if (!current.value) return
  answers.value = { ...answers.value, [current.value.id]: i }
}

function toggleFlag() {
  if (!current.value) return
  const id = current.value.id
  const next = new Set(flagged.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  flagged.value = next
}

const answeredCount = computed(() => Object.keys(answers.value || {}).length)
const total = computed(() => questions.value.length)
const progressPct = computed(() => total.value ? Math.round((answeredCount.value / total.value) * 100) : 0)

async function submit(isAuto = false) {
  if (!exam.value) return
  // prevent double submit
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const secondsTotal = Math.max(0, Math.round((Date.now() - startedAtMs.value) / 1000))
    await data.submitExam({ examId: exam.value.id, answers: answers.value, secondsTotal })
    if (timer) window.clearInterval(timer)
    timer = null
    router.replace(`/exam/${exam.value.id}/result`)
  } catch (e) {
    error.value = e?.message || 'Failed to submit exam'
    if (isAuto) {
      // auto submit failed; keep them on screen
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="h2">Exam</div>
          <p class="sub mt-1">
            <span class="font-semibold">{{ exam?.courseCode }}</span>
            <span class="text-text-3">•</span>
            {{ exam?.courseTitle }}
          </p>
        </div>
        <div class="text-right">
          <div class="text-xs text-text-3">Time left</div>
          <div class="text-lg font-extrabold">{{ fmtRemain() }}</div>
        </div>
      </div>

      <div class="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
        <div class="h-full bg-accent transition-all duration-200" :style="{ width: progressPct + '%' }" />
      </div>
      <div class="mt-2 text-xs text-text-3">Answered {{ answeredCount }} / {{ total }}</div>

      <div v-if="error" class="alert alert-warn mt-3" role="alert">{{ error }}</div>

      <div v-if="loading && !current" class="mt-4 grid gap-2">
        <div class="skeleton h-20" />
        <div class="skeleton h-12" />
        <div class="skeleton h-12" />
      </div>

      <div v-else-if="!current" class="mt-4 card card-pad">
        <div class="h2">No questions</div>
        <p class="sub mt-1">This exam session has no questions.</p>
      </div>

      <div v-else class="mt-4">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs text-text-3">Question {{ qIndex + 1 }} / {{ total }}</div>
          <button type="button" class="btn btn-ghost btn-sm" @click="toggleFlag">
            <span v-if="flagged.has(current.id)">Unflag</span>
            <span v-else>Flag</span>
          </button>
        </div>

        <div class="mt-2 text-base font-extrabold">{{ current.prompt }}</div>

        <div class="mt-3 grid gap-2">
          <button
            v-for="(opt, i) in current.options"
            :key="i"
            type="button"
            class="card card-press card-pad text-left"
            :class="(answers[current.id] === i) ? 'ring-1 ring-white/10 bg-white/[0.04]' : ''"
            @click="pick(i)"
          >
            <div class="text-sm">{{ opt }}</div>
          </button>
        </div>

        <div class="mt-4 flex items-center justify-between gap-2">
          <button class="btn btn-ghost" :disabled="qIndex === 0" @click="qIndex -= 1">Prev</button>
          <div class="flex items-center gap-2">
            <button class="btn btn-ghost" :disabled="qIndex >= total - 1" @click="qIndex += 1">Next</button>
            <button class="btn btn-primary" :disabled="loading" @click="submit(false)">Submit</button>
          </div>
        </div>
      </div>

      <div class="mt-5">
        <div class="text-sm font-extrabold">Jump to</div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="(q, i) in questions"
            :key="q.id"
            type="button"
            class="chip"
            :class="[
              i === qIndex ? 'ring-1 ring-white/10 bg-white/[0.04]' : 'hover:bg-white/[0.06]',
              flagged.has(q.id) ? 'border border-accent/40' : '',
              answers[q.id] !== undefined ? 'opacity-100' : 'opacity-60'
            ].join(' ')"
            @click="qIndex = i"
          >
            {{ i + 1 }}
          </button>
        </div>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
.chip { cursor: pointer; }
</style>
