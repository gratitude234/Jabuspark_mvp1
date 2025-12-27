<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { apiFetch } from '../utils/api'

import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const auth = useAuthStore()
const catalog = useCatalogStore()
const route = useRoute()

const profile = computed(() => auth.user?.profile || {})
const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)
const courseOptions = computed(() => myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` })))

const courseId = ref(profile.value.courseIds?.[0] || '')
const onlyDue = ref(true)

const summary = ref({ totalSaved: 0, dueNow: 0 })
const loadingSummary = ref(false)
const error = ref('')

// session
const busy = ref(false)
const session = ref(null) // { items, idx, answered, correct, startedAt }
const selectedIndex = ref(null)
const feedback = ref(null) // { isCorrect, correctIndex, explanation, nextReviewAt, dueRemaining }

function qs(params) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined) return
    const s = String(v)
    if (s.trim() === '') return
    sp.set(k, s)
  })
  const str = sp.toString()
  return str ? `?${str}` : ''
}

const current = computed(() => {
  if (!session.value) return null
  return session.value.items[session.value.idx] || null
})

async function loadSummary() {
  if (!courseId.value) return
  loadingSummary.value = true
  error.value = ''
  try {
    const res = await apiFetch(`/practice/wrong-summary${qs({ courseId: courseId.value })}`)
    summary.value = {
      totalSaved: res?.data?.totalSaved || 0,
      dueNow: res?.data?.dueNow || 0
    }
  } catch (e) {
    summary.value = { totalSaved: 0, dueNow: 0 }
    error.value = e?.message || 'Failed to load saved wrong questions.'
  } finally {
    loadingSummary.value = false
  }
}

async function startReview() {
  if (!courseId.value) return
  busy.value = true
  error.value = ''
  feedback.value = null
  selectedIndex.value = null
  try {
    const res = await apiFetch(`/practice/wrong-due${qs({ courseId: courseId.value, onlyDue: onlyDue.value ? 1 : 0, limit: 50 })}`)
    const items = res?.data?.items || []
    summary.value = {
      totalSaved: res?.data?.totalSaved || 0,
      dueNow: res?.data?.dueNow || 0
    }
    session.value = {
      items,
      idx: 0,
      answered: 0,
      correct: 0,
      startedAt: Date.now()
    }
  } catch (e) {
    error.value = e?.message || 'Failed to start review.'
    session.value = null
  } finally {
    busy.value = false
  }
}

function resetSession() {
  session.value = null
  feedback.value = null
  selectedIndex.value = null
}

async function submitCurrent() {
  if (!current.value) return
  if (selectedIndex.value === null || selectedIndex.value === undefined) return

  busy.value = true
  error.value = ''
  try {
    const sec = Math.max(0, Math.round((Date.now() - session.value.startedAt) / 1000))
    const res = await apiFetch('/practice/wrong-submit', {
      method: 'POST',
      body: {
        bankId: current.value.bankId,
        questionId: current.value.id,
        selectedIndex: selectedIndex.value,
        secondsSpent: sec,
      }
    })
    const d = res?.data || {}
    feedback.value = {
      isCorrect: !!d.isCorrect,
      correctIndex: d.correctIndex,
      explanation: d.explanation || current.value.explanation || '',
      nextReviewAt: d.nextReviewAt || null,
      dueRemaining: typeof d.dueRemaining === 'number' ? d.dueRemaining : null,
    }

    session.value.answered += 1
    if (feedback.value.isCorrect) session.value.correct += 1

    // refresh summary counts
    if (typeof d.dueRemaining === 'number') {
      summary.value.dueNow = d.dueRemaining
    }
  } catch (e) {
    error.value = e?.message || 'Failed to submit answer.'
  } finally {
    busy.value = false
  }
}

function nextQuestion() {
  if (!session.value) return
  feedback.value = null
  selectedIndex.value = null
  session.value.startedAt = Date.now()
  if (session.value.idx < session.value.items.length - 1) {
    session.value.idx += 1
  } else {
    // end
    session.value.idx = session.value.items.length
  }
}

async function removeFromSaved() {
  if (!current.value) return
  busy.value = true
  error.value = ''
  try {
    await apiFetch('/practice/wrong-remove', {
      method: 'POST',
      body: {
        bankId: current.value.bankId,
        questionId: current.value.id,
      }
    })
    // remove locally
    session.value.items.splice(session.value.idx, 1)
    if (session.value.idx >= session.value.items.length) {
      session.value.idx = session.value.items.length
    }
    await loadSummary()
    feedback.value = null
    selectedIndex.value = null
  } catch (e) {
    error.value = e?.message || 'Failed to remove question.'
  } finally {
    busy.value = false
  }
}

watch(courseId, async () => {
  resetSession()
  await loadSummary()
})

onMounted(async () => {
  // Preselect based on query params, if provided
  const qCourse = route.query.courseId ? String(route.query.courseId) : ''
  const qMode = route.query.mode ? String(route.query.mode) : ''
  if (qCourse) courseId.value = qCourse
  if (qMode === 'all') onlyDue.value = false

  await catalog.fetchCourses()
  await loadSummary()
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Saved wrong questions</h1>
        <p class="muted">Questions you miss are saved per course. Review them with spaced repetition to lock in the concepts.</p>
      </div>
      <div class="row" style="gap: 10px; align-items: center;">
        <AppButton variant="ghost" as="router-link" to="/practice">Back</AppButton>
      </div>
    </div>

    <AppCard>
      <div class="grid" style="grid-template-columns: 1fr 220px 220px; gap: 12px; align-items: end;">
        <AppSelect label="Course" v-model="courseId" :options="courseOptions" placeholder="Select course..." />
        <div>
          <label class="label">Mode</label>
          <select class="input" v-model="onlyDue">
            <option :value="true">Due now</option>
            <option :value="false">All saved</option>
          </select>
        </div>
        <div class="row" style="justify-content: flex-end;">
          <AppButton :disabled="busy || !courseId" @click="startReview">Start review</AppButton>
        </div>
      </div>

      <div class="row" style="margin-top: 12px; gap: 10px; flex-wrap: wrap;">
        <div class="pill">Saved: <b>{{ summary.totalSaved }}</b></div>
        <div class="pill">Due now: <b>{{ summary.dueNow }}</b></div>
        <div v-if="loadingSummary" class="muted">Loading…</div>
      </div>

      <div v-if="error" class="warn" style="margin-top: 12px;">{{ error }}</div>
    </AppCard>

    <div v-if="session" style="margin-top: 16px;">
      <AppCard>
        <div v-if="session.items.length === 0" class="muted">
          No questions found for this mode. Miss a question in practice and it will show up here.
        </div>

        <div v-else-if="current" class="stack" style="gap: 12px;">
          <div class="row" style="justify-content: space-between; gap: 12px;">
            <div>
              <div class="muted" style="font-size: 13px;">{{ current.bankTitle }} • {{ session.idx + 1 }} / {{ session.items.length }}</div>
              <div style="font-size: 18px; font-weight: 650; margin-top: 6px;">{{ current.prompt }}</div>
            </div>
            <div class="row" style="gap: 10px; align-items: center;">
              <AppButton variant="ghost" size="sm" :disabled="busy" @click="removeFromSaved">Remove</AppButton>
            </div>
          </div>

          <div class="stack" style="gap: 10px;">
            <label v-for="(opt, idx) in current.options" :key="idx" class="opt" :class="{ selected: selectedIndex === idx }">
              <input type="radio" :value="idx" v-model="selectedIndex" :disabled="!!feedback" />
              <span>{{ opt }}</span>
            </label>
          </div>

          <div class="row" style="justify-content: space-between; gap: 12px; align-items: center;">
            <div class="muted">Answered: {{ session.answered }} • Correct: {{ session.correct }}</div>
            <div class="row" style="gap: 10px;">
              <AppButton v-if="!feedback" :disabled="busy || selectedIndex === null" @click="submitCurrent">Check</AppButton>
              <AppButton v-else variant="primary" :disabled="busy" @click="nextQuestion">Next</AppButton>
            </div>
          </div>

          <div v-if="feedback" class="card" style="padding: 12px; border-color: rgba(255,255,255,0.12);">
            <div style="font-weight: 650;" :style="{ color: feedback.isCorrect ? 'var(--good)' : 'var(--bad)' }">
              {{ feedback.isCorrect ? 'Correct ✅' : 'Wrong ❌' }}
            </div>
            <div v-if="!feedback.isCorrect" class="muted" style="margin-top: 6px;">
              Correct option: {{ feedback.correctIndex + 1 }}
            </div>
            <div v-if="feedback.explanation" style="margin-top: 10px; line-height: 1.5;">{{ feedback.explanation }}</div>
            <div v-if="feedback.dueRemaining !== null" class="muted" style="margin-top: 10px;">
              Due remaining: {{ feedback.dueRemaining }}
            </div>
          </div>
        </div>

        <div v-else class="stack" style="gap: 10px;">
          <div style="font-size: 18px; font-weight: 650;">Review complete 🎉</div>
          <div class="muted">You answered {{ session.answered }} questions with {{ session.correct }} correct.</div>
          <div class="row" style="gap: 10px;">
            <AppButton @click="startReview">Run again</AppButton>
            <AppButton variant="ghost" @click="resetSession">Close</AppButton>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<style scoped>
.page { max-width: 980px; margin: 0 auto; }
.page-head { display:flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.muted { opacity: 0.8; }
.row { display:flex; }
.stack { display:flex; flex-direction: column; }
.pill { display:inline-flex; align-items:center; gap: 6px; padding: 6px 10px; border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; }
.warn { padding: 10px 12px; border: 1px solid rgba(255, 170, 0, 0.35); border-radius: 12px; background: rgba(255, 170, 0, 0.07); color: rgba(255, 214, 140, 1); }
.label { display:block; font-size: 12px; opacity: 0.75; margin-bottom: 6px; }
.opt { display:flex; gap: 10px; align-items:flex-start; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; cursor: pointer; }
.opt.selected { border-color: rgba(77, 214, 191, 0.6); box-shadow: 0 0 0 3px rgba(77, 214, 191, 0.12); }
.opt input { margin-top: 3px; }
@media (max-width: 720px) {
  .page-head { flex-direction: column; }
}
</style>
