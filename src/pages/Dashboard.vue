<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import { useContentStore } from '../stores/content'
import AppCard from '../components/AppCard.vue'
import StatPill from '../components/StatPill.vue'

const auth = useAuthStore()
const data = useDataStore()
const content = useContentStore()

/** ====== Profile & greeting ====== */
const profile = computed(() => auth.user?.profile || {})
const hasProfile = computed(() => !!profile.value?.departmentId)
const firstCourseId = computed(() => (profile.value.courseIds || [])[0] || '')

const greeting = computed(() => {
  const name = (auth.user?.fullName || 'Student').trim().split(/\s+/)[0]
  return `Hi, ${name}`
})

/** ====== Progress helpers (safe fallbacks) ====== */
const progress = computed(() => data.progress || {})
const streak = computed(() => Number(progress.value?.streak || 0))
const totalAnswered = computed(() => Number(progress.value?.totalAnswered || 0))
const accuracy = computed(() => {
  const a = progress.value?.accuracy
  return Number.isFinite(Number(a)) ? Number(a) : 0
})

const savedCount = computed(() => {
  const q = progress.value?.saved?.questions?.length || 0
  const m = progress.value?.saved?.materials?.length || 0
  return q + m
})

// Optional deltas if your backend provides them (won’t break if missing)
const accuracyDelta7d = computed(() => {
  const d = progress.value?.accuracyDelta7d
  return Number.isFinite(Number(d)) ? Number(d) : null
})

/** ====== “Today’s focus” (goal) ====== */
const DAILY_GOAL = 10
const todayAnswered = computed(() => {
  const t = progress.value?.todayAnswered
  return Number.isFinite(Number(t)) ? Number(t) : 0
})
const goalPct = computed(() => {
  const pct = (todayAnswered.value / DAILY_GOAL) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
})

/** ====== Banks: resume + filters ====== */
const quickBank = computed(() => content.banks?.[0] || null)
const resumeTo = computed(() => (quickBank.value ? `/practice/${quickBank.value.id}` : '/practice'))

const bankFilter = ref('all') // all | timed
const bankSort = ref('recommended') // recommended | newest | most_questions

function toTime(v) {
  if (!v) return 0
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : 0
}

const filteredBanks = computed(() => {
  const list = Array.isArray(content.banks) ? [...content.banks] : []

  const filtered =
    bankFilter.value === 'timed'
      ? list.filter((b) => String(b?.mode || '').toLowerCase().includes('tim'))
      : list

  if (bankSort.value === 'most_questions') {
    filtered.sort((a, b) => Number(b?.questionCount || 0) - Number(a?.questionCount || 0))
  } else if (bankSort.value === 'newest') {
    filtered.sort((a, b) => toTime(b?.updatedAt || b?.createdAt) - toTime(a?.updatedAt || a?.createdAt))
  }

  return filtered
})

const visibleBanks = computed(() => filteredBanks.value.slice(0, 4))

/** ====== Data loading ====== */
async function refresh() {
  if (!auth.isAuthed) return
  await Promise.allSettled([
    data.fetchProgress(),
    content.fetchBanks({ courseId: firstCourseId.value || '' })
  ])
}

onMounted(refresh)
watch(() => auth.isAuthed, (v) => v && refresh())
watch(firstCourseId, () => auth.isAuthed && content.fetchBanks({ courseId: firstCourseId.value || '' }))

/** ====== UI helpers ====== */
const dimDashboard = computed(() => !!auth.needsOnboarding)
const canPractice = computed(() => hasProfile.value && !auth.needsOnboarding)
</script>

<template>
  <main class="page" aria-label="Dashboard">
    <!-- Top-level status/error (more visible than inside cards) -->
    <div v-if="data.error" class="alert alert-warn" role="alert">
      {{ data.error }}
    </div>

    <!-- Onboarding callout -->
    <AppCard v-if="auth.needsOnboarding" class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-transparent" />
      <div class="relative">
        <div class="kicker">Welcome to JabuSpark</div>
        <h1 class="h1 mt-1">Set up your study profile</h1>
        <p class="sub mt-2 max-w-[60ch]">
          Tell us your faculty, department, and level so we can personalise practice banks, materials, and past questions.
        </p>

        <div class="mt-5 flex flex-col sm:flex-row gap-2">
          <RouterLink to="/onboarding" class="btn btn-primary btn-lg">
            Continue setup
          </RouterLink>
          <RouterLink to="/practice" class="btn btn-ghost btn-lg">
            Explore practice
          </RouterLink>
        </div>
      </div>
    </AppCard>

    <!-- Everything below is dimmed until onboarding is complete -->
    <div :class="dimDashboard ? 'opacity-50 pointer-events-none select-none' : ''">
      <!-- HERO -->
      <AppCard class="relative overflow-hidden">
        <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/14 via-transparent to-transparent" />

        <div class="relative flex flex-col gap-4">
          <header class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="kicker">Campus-ready study hub</div>

              <div class="mt-1 flex flex-wrap items-center gap-2">
                <h1 class="h1 truncate">{{ greeting }}</h1>
                <span v-if="streak" class="badge" aria-label="Streak">
                  {{ streak }}🔥
                </span>
              </div>

              <p class="sub mt-2">
                <span v-if="canPractice">Resume your momentum—pick a bank and keep going.</span>
                <span v-else>Complete onboarding to unlock personalised study and banks.</span>
              </p>

              <!-- Primary / Secondary CTA -->
              <div class="mt-4 flex flex-col sm:flex-row gap-2">
                <RouterLink
                  :to="resumeTo"
                  class="btn btn-primary btn-lg"
                  :class="!canPractice ? 'opacity-60' : ''"
                  :aria-disabled="!canPractice"
                >
                  Resume practice
                </RouterLink>
                <RouterLink to="/progress" class="btn btn-ghost btn-lg">
                  View progress
                </RouterLink>
              </div>
            </div>

            <RouterLink
              to="/profile"
              class="icon-btn focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              aria-label="Open profile"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" class="h-5 w-5">
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </RouterLink>
          </header>

          <!-- QUICK ACTIONS: horizontal scroll on mobile, grid on larger screens -->
          <section aria-label="Quick actions">
            <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-4 sm:overflow-visible">
              <RouterLink
                to="/practice"
                class="card card-press card-pad min-w-[220px] sm:min-w-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                aria-label="Go to practice"
              >
                <div class="flex items-center gap-2">
                  <span class="h-9 w-9 rounded-xl2 bg-accent/15 grid place-items-center" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                      <path d="M5 4h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
                    </svg>
                  </span>
                  <div class="min-w-0">
                    <div class="text-sm font-extrabold">Practice</div>
                    <div class="text-xs text-text-3">Quick drills</div>
                  </div>
                </div>
              </RouterLink>

              <RouterLink
                to="/materials"
                class="card card-press card-pad min-w-[220px] sm:min-w-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                aria-label="Go to materials"
              >
                <div class="flex items-center gap-2">
                  <span class="h-9 w-9 rounded-xl2 bg-accent/15 grid place-items-center" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                      <path d="M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 0-2 2V5a2 2 0 0 1 2-2Z" />
                      <path d="M8 7h9" />
                      <path d="M8 11h9" />
                      <path d="M8 15h6" />
                    </svg>
                  </span>
                  <div class="min-w-0">
                    <div class="text-sm font-extrabold">Materials</div>
                    <div class="text-xs text-text-3">PDF notes</div>
                  </div>
                </div>
              </RouterLink>

              <RouterLink
                to="/past-questions"
                class="card card-press card-pad min-w-[220px] sm:min-w-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                aria-label="Go to past questions"
              >
                <div class="flex items-center gap-2">
                  <span class="h-9 w-9 rounded-xl2 bg-accent/15 grid place-items-center" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                      <path d="M7 3h10a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z" />
                      <path d="M9 7h6" />
                      <path d="M9 11h6" />
                      <path d="M9 15h4" />
                    </svg>
                  </span>
                  <div class="min-w-0">
                    <div class="text-sm font-extrabold">Past questions</div>
                    <div class="text-xs text-text-3">Exam prep</div>
                  </div>
                </div>
              </RouterLink>

              <RouterLink
                to="/saved"
                class="card card-press card-pad min-w-[220px] sm:min-w-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                aria-label="Go to saved"
              >
                <div class="flex items-center gap-2">
                  <span class="h-9 w-9 rounded-xl2 bg-accent/15 grid place-items-center" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                      <path d="M6 3h12a2 2 0 0 1 2 2v18l-8-4-8 4V5a2 2 0 0 1 2-2Z" />
                    </svg>
                  </span>
                  <div class="min-w-0">
                    <div class="text-sm font-extrabold">Saved</div>
                    <div class="text-xs text-text-3">
                      Bookmarks
                      <span v-if="savedCount" class="ml-1 badge" aria-label="Saved count">{{ savedCount }}</span>
                    </div>
                  </div>
                </div>
              </RouterLink>
            </div>
          </section>

          <!-- Focus + Progress -->
          <section class="grid gap-3 sm:grid-cols-2" aria-label="Focus and progress">
            <!-- TODAY'S FOCUS -->
            <div class="card card-pad">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-sm font-extrabold">Today’s focus</div>
                  <div class="text-xs text-text-3">Small steps, consistent wins.</div>
                </div>
                <span class="badge">Goal: {{ DAILY_GOAL }}</span>
              </div>

              <div class="mt-4">
                <div class="flex items-center justify-between text-xs text-text-3">
                  <span>{{ todayAnswered }} / {{ DAILY_GOAL }} questions</span>
                  <span>{{ goalPct }}%</span>
                </div>
                <div class="mt-2 h-2 rounded-full bg-surface/60 overflow-hidden" aria-hidden="true">
                  <div class="h-full bg-accent" :style="{ width: goalPct + '%' }" />
                </div>

                <p class="sub mt-3">
                  Aim for {{ DAILY_GOAL }} quick questions today. Timed mode helps build exam speed.
                </p>

                <div class="mt-4 flex flex-col sm:flex-row gap-2">
                  <RouterLink :to="resumeTo" class="btn btn-primary" :class="!canPractice ? 'opacity-60' : ''">
                    Start / Resume
                  </RouterLink>
                  <RouterLink to="/past-questions" class="btn btn-ghost">
                    Review past
                  </RouterLink>
                </div>
              </div>
            </div>

            <!-- PROGRESS SNAPSHOT -->
            <div class="card card-pad">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-sm font-extrabold">Progress snapshot</div>
                  <div class="text-xs text-text-3">Updates as you practise.</div>
                </div>
                <RouterLink to="/progress" class="btn btn-ghost btn-sm">
                  Analytics
                </RouterLink>
              </div>

              <div v-if="data.loading.progress" class="mt-4 grid grid-cols-3 gap-2" aria-hidden="true">
                <div class="skeleton h-16" />
                <div class="skeleton h-16" />
                <div class="skeleton h-16" />
              </div>

              <div v-else class="mt-4 grid grid-cols-3 gap-2">
                <StatPill label="Answered" :value="totalAnswered" />
                <StatPill
                  label="Accuracy"
                  :value="accuracy + '%'"
                />
                <StatPill label="Saved" :value="savedCount" />
              </div>

              <div v-if="accuracyDelta7d !== null" class="mt-3 text-xs text-text-3">
                Accuracy vs last 7 days:
                <span class="font-bold" :class="accuracyDelta7d >= 0 ? 'text-ok' : 'text-warn'">
                  {{ accuracyDelta7d >= 0 ? '+' : '' }}{{ accuracyDelta7d }}%
                </span>
              </div>
            </div>
          </section>
        </div>
      </AppCard>

      <!-- BANKS PREVIEW -->
      <AppCard>
        <div class="row">
          <div>
            <h2 class="h2">Practice banks</h2>
            <p class="sub mt-1">Choose a bank and start drilling.</p>
          </div>
          <RouterLink to="/practice" class="btn btn-ghost">See all</RouterLink>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <!-- Filter chips -->
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :class="bankFilter === 'all' ? 'btn-primary/10' : ''"
            @click="bankFilter = 'all'"
          >
            All
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :class="bankFilter === 'timed' ? 'btn-primary/10' : ''"
            @click="bankFilter = 'timed'"
          >
            Timed
          </button>

          <span class="mx-1 h-4 w-px bg-border/60" aria-hidden="true" />

          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :class="bankSort === 'recommended' ? 'btn-primary/10' : ''"
            @click="bankSort = 'recommended'"
          >
            Recommended
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :class="bankSort === 'newest' ? 'btn-primary/10' : ''"
            @click="bankSort = 'newest'"
          >
            Newest
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :class="bankSort === 'most_questions' ? 'btn-primary/10' : ''"
            @click="bankSort = 'most_questions'"
          >
            Most questions
          </button>
        </div>

        <div class="divider my-4" />

        <div v-if="content.loading.banks" class="grid gap-2" aria-hidden="true">
          <div class="skeleton h-16" />
          <div class="skeleton h-16" />
          <div class="skeleton h-16" />
        </div>

        <div v-else-if="(content.banks?.length || 0) === 0" class="alert alert-ok" role="status">
          No practice banks yet for your current selection. Check back later or try a different course.
        </div>

        <div v-else class="grid gap-2">
          <RouterLink
            v-for="b in visibleBanks"
            :key="b.id"
            :to="`/practice/${b.id}`"
            class="card card-press card-pad focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            :aria-label="`Start ${b.title}`"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">{{ b.title }}</div>
                <div class="text-xs text-text-3 mt-1">
                  {{ b.questionCount }} questions • {{ b.mode }}
                </div>
              </div>
              <span class="badge">Start</span>
            </div>
          </RouterLink>
        </div>
      </AppCard>
    </div>
  </main>
</template>
