<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import { useContentStore } from '../stores/content'
import AppCard from '../components/AppCard.vue'
import StatPill from '../components/StatPill.vue'

const auth = useAuthStore()
const data = useDataStore()
const content = useContentStore()

const profile = computed(() => auth.user?.profile || {})

const hasProfile = computed(() => {
  const p = profile.value || {}
  return (p.level || 0) > 0 && (p.courseIds || []).length > 0
})

const firstCourseId = computed(() => (profile.value.courseIds || [])[0] || '')
const quickBank = computed(() => content.banks?.[0] || null)

const greeting = computed(() => {
  const name = (auth.user?.fullName || 'Student').split(' ')[0]
  return `Hi, ${name}`
})

const goal = computed(() => Number(data.progress?.dailyGoal || 10))
const doneToday = computed(() => Number(data.progress?.todayAnswered || 0))

const goalPct = computed(() => {
  if (!goal.value) return 0
  return Math.max(0, Math.min(100, Math.round((doneToday.value / goal.value) * 100)))
})

const goalOptions = [10, 20, 50]

async function setGoal(g) {
  await data.setDailyGoal(g)
}

const quickActions = computed(() => [
  {
    to: '/practice',
    label: 'Practice',
    sub: 'Quick drills',
    icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
        <path d="M5 4h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      </svg>`
  },
  {
    to: '/materials',
    label: 'Materials',
    sub: 'PDF notes',
    icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
        <path d="M4 4h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
      </svg>`
  },
  {
    to: '/past-questions',
    label: 'Past Q',
    sub: 'Exam prep',
    icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
        <path d="M7 3h10a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z" />
        <path d="M9 7h6" />
        <path d="M9 11h6" />
      </svg>`
  },
  {
    to: '/saved',
    label: 'Saved',
    sub: 'Bookmarks',
    icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
        <path d="M6 3h12a2 2 0 0 1 2 2v18l-8-4-8 4V5a2 2 0 0 1 2-2Z" />
      </svg>`
  },
  {
    to: '/notify',
    label: 'Updates',
    sub: `${data.progress.notifyUnread || 0} new`,
    badge: (data.progress.notifyUnread || 0) > 0,
    icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>`
  },
  {
    to: '/groups',
    label: 'Groups',
    sub: `${data.groups?.pending || 0} pending`,
    badge: (data.groups?.pending || 0) > 0,
    icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>`
  }
])

onMounted(async () => {
  if (!auth.isAuthed) return

  await Promise.allSettled([
    data.fetchProgress(),
    content.fetchBanks({ courseId: firstCourseId.value || '' })
  ])
})
</script>

<template>
  <!-- Better spacing + max width for laptop -->
  <div class="page mx-auto max-w-6xl px-3 sm:px-4 lg:px-6 space-y-3 sm:space-y-4">
    <!-- Onboarding banner -->
    <AppCard v-if="auth.needsOnboarding" class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-transparent" />
      <div class="relative">
        <div class="kicker">Welcome to JabuSpark</div>
        <div class="h1 mt-1">Set up your study profile</div>
        <p class="sub mt-2 max-w-[56ch]">
          Tell us your faculty, department, and level so we can personalise practice banks, materials, and past questions for you.
        </p>

        <div class="mt-5 flex flex-col sm:flex-row gap-2">
          <RouterLink to="/onboarding" class="btn btn-primary btn-lg">Continue setup</RouterLink>
          <RouterLink to="/practice" class="btn btn-ghost btn-lg">Explore practice</RouterLink>
        </div>
      </div>
    </AppCard>

    <!-- Main hero -->
    <AppCard class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/14 via-transparent to-transparent" />

      <div class="relative">
        <!-- Header -->
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="kicker">Campus-ready study hub</div>
            <div class="h1 mt-1 truncate">{{ greeting }}</div>
            <p class="sub mt-2">
              {{
                hasProfile
                  ? 'Pick up where you left off and keep your streak going.'
                  : 'Finish quick setup (GNS or department) to unlock personalised study.'
              }}
            </p>
          </div>

          <RouterLink to="/profile" class="icon-btn" aria-label="Open profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </RouterLink>
        </div>

        <!-- Responsive layout:
             Mobile = stacked, Desktop = 2 columns -->
        <div class="mt-4 lg:grid lg:grid-cols-12 lg:gap-4">
          <!-- Left column -->
          <div class="lg:col-span-7 flex flex-col gap-3">
            <!-- Quick actions: swipe on mobile, grid on larger screens -->
            <div
              class="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3
                     sm:mx-0 sm:px-0 sm:overflow-visible sm:grid sm:grid-cols-3
                     lg:grid-cols-6"
            >
              <RouterLink
                v-for="a in quickActions"
                :key="a.to"
                :to="a.to"
                class="card card-press card-pad relative shrink-0 w-[11rem] sm:w-auto"
                :aria-label="`Go to ${a.label}`"
              >
                <div class="flex items-center gap-2">
                  <span class="h-9 w-9 rounded-xl2 bg-accent/15 grid place-items-center relative">
                    <span v-html="a.icon" />
                    <span
                      v-if="a.badge"
                      class="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface"
                    />
                  </span>
                  <div class="min-w-0">
                    <div class="text-sm font-extrabold truncate">{{ a.label }}</div>
                    <div class="text-xs text-text-3 truncate">{{ a.sub }}</div>
                  </div>
                </div>
              </RouterLink>
            </div>

            <!-- Today's focus -->
            <div class="card card-pad">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-sm font-extrabold">Today’s focus</div>
                  <p class="sub mt-1">
                    Do <b>{{ data.progress.dailyGoal }}</b> questions today, then review your wrong answers.
                  </p>
                </div>
                <span class="badge">{{ data.progress.streak }}🔥</span>
              </div>

              <div class="mt-3">
                <div class="flex items-center justify-between text-xs text-text-3">
                  <span>Progress</span>
                  <span>{{ data.progress.todayAnswered }} / {{ data.progress.dailyGoal }}</span>
                </div>

                <div class="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div class="h-full bg-accent transition-all duration-200" :style="{ width: goalPct + '%' }" />
                </div>

                <!-- Goal picker: looks like a segmented control -->
                <div class="mt-3 flex flex-wrap gap-2 items-center">
                  <button
                    v-for="g in goalOptions"
                    :key="g"
                    type="button"
                    class="btn btn-sm"
                    :class="goal === g ? 'btn-primary' : 'btn-ghost'"
                    @click="setGoal(g)"
                  >
                    Goal {{ g }}
                  </button>

                  <div class="flex-1" />
                  <span class="badge">Level {{ data.progress.level }} • {{ data.progress.xp }} XP</span>
                </div>

                <div class="mt-3 flex flex-col sm:flex-row gap-2">
                  <RouterLink
                    :to="quickBank ? `/practice/${quickBank.id}` : '/practice'"
                    class="btn btn-primary"
                  >
                    {{ quickBank ? 'Continue practice' : 'Browse banks' }}
                  </RouterLink>
                  <RouterLink to="/materials" class="btn btn-ghost">Open materials</RouterLink>
                </div>
              </div>
            </div>
          </div>

          <!-- Right column -->
          <div class="lg:col-span-5 mt-3 lg:mt-0">
            <div class="card card-pad h-full">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-extrabold">Progress snapshot</div>
                  <div class="text-xs text-text-3">Updates as you practise.</div>
                </div>
                <div class="badge">{{ data.progress.streak }}🔥</div>
              </div>

              <div v-if="data.loading.progress" class="mt-4 grid grid-cols-3 gap-2">
                <div class="skeleton h-16" />
                <div class="skeleton h-16" />
                <div class="skeleton h-16" />
              </div>

              <div v-else class="mt-4 grid grid-cols-3 gap-2">
                <StatPill label="Answered" :value="data.progress.totalAnswered" />
                <StatPill label="Accuracy" :value="data.progress.accuracy + '%'" />
                <StatPill
                  label="Saved"
                  :value="(data.progress.saved?.pastQuestions?.length || 0) + (data.progress.saved?.materials?.length || 0)"
                />
              </div>

              <div v-if="data.error" class="alert alert-warn mt-3" role="alert">
                {{ data.error }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- Practice banks preview -->
    <AppCard>
      <div class="row">
        <div>
          <div class="h2">Practice banks</div>
          <p class="sub mt-1">Choose a bank and start drilling.</p>
        </div>
        <RouterLink to="/practice" class="btn btn-ghost">See all</RouterLink>
      </div>

      <div class="divider my-4" />

      <div v-if="content.loading.banks" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>

      <div v-else-if="content.banks.length === 0" class="alert alert-ok" role="status">
        No practice banks yet for your current selection. Check back later or try a different course.
      </div>

      <div v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="b in content.banks.slice(0, 6)"
          :key="b.id"
          :to="`/practice/${b.id}`"
          class="card card-press card-pad"
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
