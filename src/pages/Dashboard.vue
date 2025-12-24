<script setup>
import { computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import { useContentStore } from '../stores/content'
import AppCard from '../components/AppCard.vue'
import StatPill from '../components/StatPill.vue'

const auth = useAuthStore()
const data = useDataStore()
const content = useContentStore()

const profile = computed(() => auth.user?.profile || {})
const hasProfile = computed(() => !!profile.value?.departmentId)
const firstCourseId = computed(() => (profile.value.courseIds || [])[0] || '')
const quickBank = computed(() => content.banks?.[0] || null)

const greeting = computed(() => {
  const name = (auth.user?.fullName || 'Student').split(' ')[0]
  return `Hi, ${name}`
})

const savedCount = computed(() => {
  const pq = data.progress.saved?.pastQuestions?.length || 0
  const mat = data.progress.saved?.materials?.length || 0
  return pq + mat
})

const streak = computed(() => Number(data.progress.streak || 0))
const accuracyPercent = computed(() => {
  const n = Number(data.progress.accuracy || 0)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, n))
})

const fetchAll = async () => {
  if (!auth.isAuthed) return
  await Promise.allSettled([
    data.fetchProgress(),
    content.fetchBanks({ courseId: firstCourseId.value || '' })
  ])
}

const retryProgress = async () => {
  await data.fetchProgress()
}

onMounted(fetchAll)

// If profile loads later (or course changes), refresh banks automatically
watch(
  () => [auth.isAuthed, firstCourseId.value],
  async ([isAuthed]) => {
    if (!isAuthed) return
    await content.fetchBanks({ courseId: firstCourseId.value || '' })
  }
)
</script>

<template>
  <div class="page">
    <!-- Onboarding -->
    <AppCard v-if="auth.needsOnboarding" class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-transparent" />

      <div class="relative">
        <p class="kicker">Welcome to JabuSpark</p>
        <h1 class="h1 mt-1">Set up your study profile</h1>
        <p class="sub mt-2 max-w-[56ch]">
          Tell us your faculty, department, and level so we can personalise practice banks, materials, and past questions
          for you.
        </p>

        <div class="mt-5 flex flex-col sm:flex-row gap-2">
          <RouterLink to="/onboarding" class="btn btn-primary btn-lg">Continue setup</RouterLink>
          <RouterLink to="/practice" class="btn btn-ghost btn-lg">Explore practice</RouterLink>
        </div>
      </div>
    </AppCard>

    <!-- Hero (only after onboarding) -->
    <AppCard v-else class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/14 via-transparent to-transparent" />

      <div class="relative flex flex-col gap-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="kicker">Campus-ready study hub</p>
            <h1 class="h1 mt-1 truncate">{{ greeting }}</h1>
            <p class="sub mt-2">
              {{ hasProfile ? 'Pick up where you left off and keep your streak going.' : 'Complete onboarding to unlock personalised study.' }}
            </p>
          </div>

          <RouterLink
            to="/profile"
            class="icon-btn"
            aria-label="Open profile"
            title="Profile"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-5 w-5"
            >
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </RouterLink>
        </div>

        <!-- Quick actions -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <RouterLink
            to="/practice"
            class="card card-press card-pad min-h-[72px] focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="Go to practice"
          >
            <div class="flex items-center gap-2">
              <span class="h-10 w-10 rounded-xl2 bg-accent/15 grid place-items-center">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                  <path d="M5 4h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
                </svg>
              </span>
              <div>
                <div class="text-sm font-extrabold">Practice</div>
                <div class="text-xs text-text-3">Quick drills</div>
              </div>
            </div>
          </RouterLink>

          <RouterLink
            to="/materials"
            class="card card-press card-pad min-h-[72px] focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="Go to materials"
          >
            <div class="flex items-center gap-2">
              <span class="h-10 w-10 rounded-xl2 bg-accent/15 grid place-items-center">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                  <path d="M4 4h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
                  <path d="M8 8h8" />
                  <path d="M8 12h8" />
                </svg>
              </span>
              <div>
                <div class="text-sm font-extrabold">Materials</div>
                <div class="text-xs text-text-3">PDF notes</div>
              </div>
            </div>
          </RouterLink>

          <RouterLink
            to="/past-questions"
            class="card card-press card-pad min-h-[72px] focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="Go to past questions"
          >
            <div class="flex items-center gap-2">
              <span class="h-10 w-10 rounded-xl2 bg-accent/15 grid place-items-center">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                  <path d="M7 3h10a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z" />
                  <path d="M9 7h6" />
                  <path d="M9 11h6" />
                </svg>
              </span>
              <div>
                <div class="text-sm font-extrabold">Past Q</div>
                <div class="text-xs text-text-3">Exam prep</div>
              </div>
            </div>
          </RouterLink>

          <RouterLink
            to="/saved"
            class="card card-press card-pad min-h-[72px] focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="Go to saved"
          >
            <div class="flex items-center gap-2">
              <span class="h-10 w-10 rounded-xl2 bg-accent/15 grid place-items-center">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                  <path d="M6 3h12a2 2 0 0 1 2 2v18l-8-4-8 4V5a2 2 0 0 1 2-2Z" />
                </svg>
              </span>
              <div>
                <div class="text-sm font-extrabold">Saved</div>
                <div class="text-xs text-text-3">Bookmarks</div>
              </div>
            </div>
          </RouterLink>
        </div>

        <!-- Primary focus + progress -->
        <div class="grid gap-2 sm:grid-cols-2">
          <!-- Primary CTA -->
          <section class="card card-pad" aria-label="Today’s focus">
            <h2 class="text-sm font-extrabold">Today’s focus</h2>
            <p class="sub mt-1">Do 10 questions, then review your wrong answers.</p>

            <div class="mt-3 flex flex-col sm:flex-row gap-2">
              <RouterLink
                :to="quickBank ? `/practice/${quickBank.id}` : '/practice'"
                class="btn btn-primary"
              >
                {{ quickBank ? 'Start a bank' : 'Browse banks' }}
              </RouterLink>
              <RouterLink to="/materials" class="btn btn-ghost">Open materials</RouterLink>
            </div>
          </section>

          <!-- Progress -->
          <section class="card card-pad" aria-label="Progress snapshot">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-sm font-extrabold">Progress snapshot</h2>
                <p class="text-xs text-text-3">Updates as you practise.</p>
              </div>
              <div class="badge" :title="`Streak: ${streak} day(s)`">{{ streak }}🔥</div>
            </div>

            <div v-if="data.loading.progress" class="mt-4 grid grid-cols-3 gap-2" aria-busy="true">
              <div class="skeleton h-16" />
              <div class="skeleton h-16" />
              <div class="skeleton h-16" />
            </div>

            <div v-else class="mt-4">
              <div class="grid grid-cols-3 gap-2">
                <StatPill label="Answered" :value="data.progress.totalAnswered" />
                <StatPill label="Accuracy" :value="accuracyPercent + '%'" />
                <StatPill label="Saved" :value="savedCount" />
              </div>

              <!-- Tiny accuracy bar for faster “at a glance” reading -->
              <div class="mt-3">
                <div class="flex items-center justify-between text-xs text-text-3">
                  <span>Accuracy</span>
                  <span>{{ accuracyPercent }}%</span>
                </div>
                <div class="mt-1 h-2 rounded-full bg-accent/10 overflow-hidden">
                  <div class="h-full bg-accent/60" :style="{ width: accuracyPercent + '%' }" />
                </div>
              </div>
            </div>

            <div
              v-if="data.error"
              class="alert alert-warn mt-3 flex items-start justify-between gap-3"
              role="alert"
            >
              <div class="min-w-0">
                <div class="text-sm font-extrabold">Couldn’t load progress</div>
                <div class="text-xs text-text-3 mt-0.5">{{ data.error }}</div>
              </div>
              <button type="button" class="btn btn-ghost" @click="retryProgress">Retry</button>
            </div>
          </section>
        </div>
      </div>
    </AppCard>

    <!-- Banks list preview -->
    <AppCard>
      <div class="row">
        <div>
          <h2 class="h2">Practice banks</h2>
          <p class="sub mt-1">Choose a bank and start drilling.</p>
        </div>
        <RouterLink to="/practice" class="btn btn-ghost">See all</RouterLink>
      </div>

      <div class="divider my-4" />

      <div v-if="content.loading.banks" class="grid gap-2" aria-busy="true">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>

      <div v-else-if="content.banks.length === 0" class="alert alert-ok" role="status">
        <div class="font-extrabold text-sm">No banks for this selection yet</div>
        <div class="text-xs text-text-3 mt-0.5">
          Check back later, or update your course to see available banks.
        </div>
        <div class="mt-3 flex flex-col sm:flex-row gap-2">
          <RouterLink to="/profile" class="btn btn-ghost">Change course</RouterLink>
          <RouterLink to="/practice" class="btn btn-primary">Browse all banks</RouterLink>
        </div>
      </div>

      <div v-else class="grid gap-2">
        <RouterLink
          v-for="b in content.banks.slice(0, 4)"
          :key="b.id"
          :to="`/practice/${b.id}`"
          class="card card-press card-pad min-h-[72px] focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-extrabold truncate">{{ b.title }}</div>
              <div class="text-xs text-text-3 mt-1">{{ b.questionCount }} questions • {{ b.mode }}</div>
            </div>
            <span class="badge">Start</span>
          </div>
        </RouterLink>
      </div>
    </AppCard>
  </div>
</template>
