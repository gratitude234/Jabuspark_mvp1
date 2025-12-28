<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useContentStore } from '../stores/content'
import { useDataStore } from '../stores/data'
import { useAiStore } from '../stores/ai'
import { apiFetch } from '../utils/api'
import AppCard from '../components/AppCard.vue'
import AppInput from '../components/AppInput.vue'
import AppSelect from '../components/AppSelect.vue'
import StatPill from '../components/StatPill.vue'

const auth = useAuthStore()
const router = useRouter()
const catalog = useCatalogStore()
const content = useContentStore()
const data = useDataStore()
const ai = useAiStore()

const profile = computed(() => auth.user?.profile || {})
const selectedCourseId = ref(profile.value.courseIds?.[0] || null)
const query = ref('')

// Practice modes
const modeShuffle = ref(false)
const modeTimed = ref(false)
const modeMinutes = ref(10)

const aiTopic = ref('')
const aiDifficulty = ref('mixed')
const aiCount = ref(8)
const aiError = ref('')

// Saved wrong questions (spaced repetition)
const wrongTotal = ref(0)
const wrongDue = ref(0)
const wrongLoading = ref(false)

async function fetchWrongSummary(courseId) {
  if (!courseId) { wrongTotal.value = 0; wrongDue.value = 0; return }
  wrongLoading.value = true
  try {
    const res = await apiFetch(`/practice/wrong-summary?courseId=${encodeURIComponent(courseId)}`)
    wrongTotal.value = Number(res?.totalSaved || 0)
    wrongDue.value = Number(res?.dueNow || 0)
  } catch {
    // If table isn't migrated yet or API fails, don't block practice
    wrongTotal.value = 0
    wrongDue.value = 0
  } finally {
    wrongLoading.value = false
  }
}

const myCourses = computed(() =>
  (catalog.courses || []).filter(c => (profile.value.courseIds || []).includes(c.id))
)
const courseOptions = computed(() => myCourses.value.map(c => ({ value: c.id, label: `${c.code} (${c.level})` })))

watch(selectedCourseId, async (cid) => {
  await content.fetchBanks({ courseId: cid || '' })
  if (cid) await data.fetchCourseTrend({ courseId: cid, days: 14 })
  await fetchWrongSummary(cid)
})

onMounted(async () => {
  await Promise.allSettled([catalog.fetchCourses(), data.fetchProgress()])
  await content.fetchBanks({ courseId: selectedCourseId.value || '' })
  if (selectedCourseId.value) await data.fetchCourseTrend({ courseId: selectedCourseId.value, days: 14 })
  await fetchWrongSummary(selectedCourseId.value)
})

const trend = computed(() => {
  const cid = selectedCourseId.value
  return cid ? (data.courseTrend?.[cid] || null) : null
})

function bankLink(id) {
  const parts = []
  if (modeShuffle.value) parts.push('shuffle=1')
  if (modeTimed.value) {
    const mins = Math.max(1, Math.min(60, Number(modeMinutes.value) || 10))
    parts.push('timed=1')
    parts.push(`minutes=${encodeURIComponent(String(mins))}`)
  }
  const qs = parts.length ? `?${parts.join('&')}` : ''
  return `/practice/${id}${qs}`
}

const banks = computed(() => {
  const list = content.banks || []
  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((b) => {
    const hay = [b.title, b.mode].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
})

async function generateAiBank() {
  if (!selectedCourseId.value) return
  aiError.value = ''
  try {
    const out = await ai.generateBank({
      courseId: selectedCourseId.value,
      topic: aiTopic.value,
      difficulty: aiDifficulty.value,
      count: aiCount.value,
    })
    if (out?.bankId) {
      await content.fetchBanks({ courseId: selectedCourseId.value || '' })
      router.push(`/practice/${out.bankId}`)
    }
  } catch (e) {
    aiError.value = e?.message || 'Failed to generate AI bank'
  }
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="h1">Practice</div>
          <p class="sub mt-1">Quick drills to boost recall and exam confidence.</p>

          <div class="mt-4 grid grid-cols-3 gap-2">
            <StatPill label="Streak" :value="data.progress.streak" />
            <StatPill label="Accuracy" :value="data.progress.accuracy + '%'" />
            <StatPill label="Answered" :value="data.progress.totalAnswered" />
          </div>
        </div>

        <div class="w-full sm:w-[340px]">
          <label class="label" for="course">Course</label>
          <AppSelect
            id="course"
            v-model="selectedCourseId"
            :options="courseOptions"
            placeholder="All my courses"
          />
          <p class="help">Tip: choose a course to see focused banks.</p>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="banksearch">Search</label>
          <AppInput
            id="banksearch"
            v-model="query"
            placeholder="Search banks…"
          />
        </div>

        <div>
          <div class="label">Practice modes</div>
          <div class="seg mt-1 w-full">
            <button
              type="button"
              class="seg-btn w-full"
              :class="modeShuffle ? 'seg-btn--active' : 'seg-btn--inactive'"
              @click="modeShuffle = !modeShuffle"
            >
              Shuffle
            </button>
            <button
              type="button"
              class="seg-btn w-full"
              :class="modeTimed ? 'seg-btn--active' : 'seg-btn--inactive'"
              @click="modeTimed = !modeTimed"
            >
              Timed
            </button>
          </div>

          <div v-if="modeTimed" class="mt-2">
            <label class="help" for="modeMinutes">Minutes</label>
            <AppInput id="modeMinutes" v-model="modeMinutes" type="number" min="1" max="60" />
          </div>
          <p class="help">Modes apply when you open a bank.</p>
        </div>
      </div>

      <div v-if="trend" class="mt-4 card card-pad">
        <div class="row">
          <div>
            <div class="h3">Course progress (last {{ trend.days }} days)</div>
            <p class="help">Accuracy trend based on your practice attempts.</p>
          </div>
          <div class="text-right">
            <div class="text-xl font-extrabold">{{ trend.overall?.accuracy ?? 0 }}%</div>
            <div class="text-xs text-text-3">{{ trend.overall?.correct ?? 0 }}/{{ trend.overall?.total ?? 0 }}</div>
          </div>
        </div>

        <div v-if="trend.points?.length" class="mt-3 flex items-end gap-1 h-12">
          <div
            v-for="p in trend.points"
            :key="p.date"
            class="flex-1 rounded-xl2 bg-white/10 ring-1 ring-white/10"
            :style="{ height: Math.max(8, Math.round((p.accuracy || 0) * 0.48)) + 'px' }"
            :title="p.date + ' • ' + p.accuracy + '% (' + p.correct + '/' + p.total + ')'"
          />
        </div>
        <div v-else class="help mt-2">No attempts yet. Start a bank to build your trend.</div>
      </div>

      <div v-if="content.error" class="alert alert-warn mt-4" role="alert">{{ content.error }}</div>
    </AppCard>

    <!-- Saved wrong questions (spaced repetition) -->
    <AppCard class="mt-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="h2">Saved wrong questions</div>
          <p class="sub mt-1">Questions you miss are saved so you can review them later (spaced repetition).
          </p>
        </div>
        <div class="flex-1" />
      </div>

      <div class="mt-3">
        <div v-if="!selectedCourseId" class="help">Select a course above to see your saved wrong questions for that course.</div>
        <div v-else class="flex flex-col sm:flex-row sm:items-center gap-2">
          <div class="flex items-center gap-2">
            <span class="badge" :title="'Total saved wrong questions'">Saved: {{ wrongTotal }}</span>
            <span class="badge" :title="'Due for review now'">Due: {{ wrongDue }}</span>
            <span v-if="wrongLoading" class="text-xs text-text-3">Loading…</span>
          </div>

          <div class="flex-1" />

          <RouterLink
            class="btn btn-primary w-full sm:w-auto"
            :to="`/review?courseId=${encodeURIComponent(selectedCourseId)}`"
          >
            Review due
          </RouterLink>
          <RouterLink
            class="btn w-full sm:w-auto"
            :to="`/review?courseId=${encodeURIComponent(selectedCourseId)}&mode=all`"
          >
            View all saved
          </RouterLink>
        </div>

        <p v-if="selectedCourseId && wrongTotal === 0" class="help mt-2">
          You don’t have any saved wrong questions yet. Once you miss a question, it will appear here automatically.
        </p>
      </div>
    </AppCard>

    <!-- AI Generator -->
    <AppCard class="mt-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="h2">AI quick quiz</div>
          <p class="sub mt-1">Generate a fresh MCQ bank for the selected course using Gemini.</p>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="sm:col-span-2">
          <label class="label" for="aiTopic">Topic (optional)</label>
          <AppInput id="aiTopic" v-model="aiTopic" placeholder="e.g., Embryology: gastrulation" />
        </div>
        <div>
          <label class="label" for="aiCount">Questions</label>
          <AppInput id="aiCount" v-model="aiCount" type="number" min="3" max="20" placeholder="8" />
        </div>
      </div>

      <div class="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <div class="w-full sm:w-[220px]">
          <label class="label" for="aiDifficulty">Difficulty</label>
          <select id="aiDifficulty" v-model="aiDifficulty" class="input">
            <option value="mixed">Mixed</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div class="flex-1" />

        <button
          class="btn btn-primary w-full sm:w-auto"
          :disabled="!selectedCourseId || ai.loading.generateBank"
          @click="generateAiBank"
        >
          <span v-if="!ai.loading.generateBank">Generate bank</span>
          <span v-else>Generating…</span>
        </button>
      </div>

      <div v-if="aiError" class="alert alert-warn mt-3" role="alert">{{ aiError }}</div>
      <p class="help mt-2">Tip: AI banks are saved like normal practice banks so you can revisit them later.</p>
    </AppCard>

    <AppCard v-if="content.loading.banks">
      <div class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>
    </AppCard>

    <AppCard v-else-if="banks.length === 0">
      <div class="h2">No banks found</div>
      <p class="sub mt-1">
        Try selecting a different course, or check back later as new banks are added.
      </p>
    </AppCard>

    <div v-else class="grid gap-3">
      <RouterLink
        v-for="b in banks"
        :key="b.id"
        :to="bankLink(b.id)"
        class="card card-press card-pad"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-base font-extrabold truncate">{{ b.title }}</div>
            <div class="text-sm text-text-2 mt-1">
              {{ b.questionCount }} questions
              <span class="text-text-3">•</span>
              {{ b.mode }}
            </div>
          </div>

          <div class="flex flex-col items-end gap-2">
            <span class="badge">Start</span>
            <span class="text-xs text-text-3">Tap to open</span>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
