<template>
  <div class="page space-y-3">
    <!-- Unified hero -->
    <AppCard class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/14 via-transparent to-transparent" />

      <div class="relative flex flex-col gap-4">
        <!-- Top row -->
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="kicker">Campus-ready study hub</div>
            <div class="h1 mt-1 truncate">{{ greeting }}</div>
            <p class="sub mt-2">
              {{ hasProfile ? 'Pick up where you left off and keep your streak going.' : 'Complete onboarding to unlock personalised study.' }}
            </p>
          </div>

          <RouterLink
            to="/profile"
            class="icon-btn focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label="Open profile"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </RouterLink>
        </div>

        <!-- If onboarding: compact callout inside hero -->
        <div v-if="auth.needsOnboarding" class="card card-pad border border-accent/20 bg-accent/5">
          <div class="text-sm font-extrabold">Finish setup to personalise your study</div>
          <p class="sub mt-1 max-w-[60ch]">
            Tell us your faculty, department, and level so we can tailor practice banks and materials for you.
          </p>
          <div class="mt-3 flex flex-col sm:flex-row gap-2">
            <RouterLink to="/onboarding" class="btn btn-primary btn-lg">Continue setup</RouterLink>
            <RouterLink to="/practice" class="btn btn-ghost btn-lg">Explore practice</RouterLink>
          </div>
        </div>

        <!-- Main content row -->
        <div class="grid gap-2 lg:grid-cols-12">
          <!-- Primary plan panel -->
          <div class="lg:col-span-7 card card-pad">
            <div class="text-xs text-text-3">Recommended next</div>
            <div class="text-base font-extrabold mt-1">{{ dashboardPlan.title }}</div>
            <p class="sub mt-1">{{ dashboardPlan.subtitle }}</p>

            <div class="mt-4 flex flex-col sm:flex-row gap-2">
              <RouterLink
                :to="dashboardPlan.primary.to"
                class="btn btn-primary btn-lg sm:btn-md w-full sm:w-auto"
              >
                {{ dashboardPlan.primary.label }}
              </RouterLink>

              <RouterLink
                v-if="dashboardPlan.secondary"
                :to="dashboardPlan.secondary.to"
                class="btn btn-ghost btn-lg sm:btn-md w-full sm:w-auto"
              >
                {{ dashboardPlan.secondary.label }}
              </RouterLink>
            </div>
          </div>

          <!-- Progress panel -->
          <div class="lg:col-span-5 card card-pad" aria-live="polite">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-extrabold">Progress snapshot</div>
                <div class="text-xs text-text-3">Updates as you practise.</div>
              </div>

              <div
                class="badge"
                :aria-label="`Streak: ${data.progress.streak} days`"
                role="img"
              >
                {{ data.progress.streak }}🔥
              </div>
            </div>

            <div v-if="data.loading.progress" class="mt-4 grid grid-cols-3 gap-2">
              <div class="skeleton h-16" />
              <div class="skeleton h-16" />
              <div class="skeleton h-16" />
            </div>

            <div v-else class="mt-4 grid grid-cols-3 gap-2">
              <StatPill label="Answered" :value="data.progress.totalAnswered" />
              <StatPill label="Accuracy" :value="data.progress.accuracy + '%'" />
              <StatPill label="Saved" :value="savedCount" />
            </div>

            <div v-if="data.error" class="alert alert-warn mt-3" role="alert">
              <div class="flex items-center justify-between gap-2">
                <span>{{ data.error }}</span>
                <button
                  type="button"
                  class="btn btn-ghost focus:outline-none focus:ring-2 focus:ring-accent/40"
                  @click="retry"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick actions (more “shortcut” feel) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <RouterLink to="/practice" class="card card-press card-pad" aria-label="Practice">
            <div class="flex items-center gap-2">
              <span class="h-9 w-9 rounded-xl2 bg-accent/15 grid place-items-center">
                <!-- icon -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                  <path d="M5 4h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
                </svg>
              </span>
              <div class="min-w-0">
                <div class="text-sm font-extrabold">Practice</div>
                <div class="text-xs text-text-3 truncate">Quick drills</div>
              </div>
            </div>
          </RouterLink>

          <RouterLink to="/materials" class="card card-press card-pad" aria-label="Materials">
            <div class="flex items-center gap-2">
              <span class="h-9 w-9 rounded-xl2 bg-accent/15 grid place-items-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                  <path d="M4 4h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
                  <path d="M8 8h8" />
                  <path d="M8 12h8" />
                </svg>
              </span>
              <div class="min-w-0">
                <div class="text-sm font-extrabold">Materials</div>
                <div class="text-xs text-text-3 truncate">PDF notes</div>
              </div>
            </div>
          </RouterLink>

          <RouterLink to="/past-questions" class="card card-press card-pad" aria-label="Past questions">
            <div class="flex items-center gap-2">
              <span class="h-9 w-9 rounded-xl2 bg-accent/15 grid place-items-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                  <path d="M7 3h10a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z" />
                  <path d="M9 7h6" />
                  <path d="M9 11h6" />
                </svg>
              </span>
              <div class="min-w-0">
                <div class="text-sm font-extrabold">Past Q</div>
                <div class="text-xs text-text-3 truncate">Exam prep</div>
              </div>
            </div>
          </RouterLink>

          <RouterLink to="/saved" class="card card-press card-pad" aria-label="Saved">
            <div class="flex items-center gap-2">
              <span class="h-9 w-9 rounded-xl2 bg-accent/15 grid place-items-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-accent">
                  <path d="M6 3h12a2 2 0 0 1 2 2v18l-8-4-8 4V5a2 2 0 0 1 2-2Z" />
                </svg>
              </span>
              <div class="min-w-0">
                <div class="text-sm font-extrabold">Saved</div>
                <div class="text-xs text-text-3 truncate">Bookmarks</div>
              </div>
            </div>
          </RouterLink>
        </div>
      </div>
    </AppCard>

    <!-- Banks list preview -->
    <AppCard>
      <div class="row">
        <div>
          <div class="h2">Practice banks</div>
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
        <div class="flex items-start justify-between gap-3">
          <div>
            No practice banks yet for your current selection.
            <div class="text-xs text-text-3 mt-1">Try another course or check back later.</div>
          </div>
          <RouterLink to="/practice" class="btn btn-ghost">Browse</RouterLink>
        </div>
      </div>

      <div v-else class="grid gap-2">
        <RouterLink
          v-for="b in content.banks.slice(0, 4)"
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
