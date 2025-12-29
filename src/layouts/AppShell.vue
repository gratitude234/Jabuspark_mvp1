<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import LogoMark from '../components/LogoMark.vue'

const route = useRoute()
const auth = useAuthStore()
const data = useDataStore()

const isMatch = (prefix) => {
  const p = route.path || ''
  return p === prefix || p.startsWith(prefix + '/') || p.startsWith(prefix)
}

const title = computed(() => route.meta?.title || 'JabuSpark')
const notifyUnread = computed(() => Number(data.progress?.notifyUnread || 0))
const groupPending = computed(() => Number(data.groups?.pending || 0))

const navItems = computed(() => [
  { key: 'home', label: 'Home', to: '/dashboard', match: () => isMatch('/dashboard') },
  { key: 'practice', label: 'Practice', to: '/practice', match: () => isMatch('/practice') },
  { key: 'pastq', label: 'PastQ', to: '/past-questions', match: () => isMatch('/past-questions') },
  { key: 'materials', label: 'Materials', to: '/materials', match: () => isMatch('/materials') },
  { key: 'saved', label: 'Saved', to: '/saved', match: () => isMatch('/saved') },
  { key: 'progress', label: 'Progress', to: '/progress', match: () => isMatch('/progress') },
])

const desktopNavClass = (active) => {
  return [
    'btn btn-ghost btn-sm',
    active ? 'bg-white/[0.08] ring-1 ring-white/10 text-text' : 'text-text-2 hover:text-text',
  ].join(' ')
}

function iconPath(key) {
  switch (key) {
    case 'home':
      return 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z'
    case 'practice':
      return 'M5 4h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z'
    case 'pastq':
      return 'M7 3h10a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z'
    case 'materials':
      return 'M4 4h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z'
    case 'saved':
      return 'M6 3h12a2 2 0 0 1 2 2v18l-8-4-8 4V5a2 2 0 0 1 2-2Z'
    default:
      return 'M4 4h16v16H4z'
  }
}

onMounted(async () => {
  // keep the bell badge fresh
  if (auth.isAuthed) {
    await Promise.allSettled([data.fetchProgress(), data.fetchNotifyChannels(), data.fetchGroupBadge()])
  }
})

</script>

<template>
  <!-- Bottom padding accounts for fixed mobile nav + iOS safe-area -->
  <div class="min-h-dvh pb-[calc(86px+env(safe-area-inset-bottom))] sm:pb-0">
    <!-- Top bar -->
    <header class="sticky top-0 z-40 border-b border-stroke/70 bg-surface/75 backdrop-blur-xl">
      <div class="container-app h-16 flex items-center justify-between gap-3">
        <RouterLink
          to="/dashboard"
          class="hover:opacity-90 flex items-center gap-2"
          aria-label="Go to dashboard"
        >
          <LogoMark variant="auto" :mobile="9" :desktop="11" alt="JabuSpark" />
        </RouterLink>

        <!-- Desktop nav -->
        <nav class="hidden sm:flex items-center gap-2" aria-label="Primary">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :class="desktopNavClass(item.match())"
            :aria-current="item.match() ? 'page' : undefined"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="flex items-center gap-2">
          <div class="hidden sm:block text-sm text-text-2">{{ title }}</div>

          <RouterLink
            to="/notify"
            class="btn btn-ghost btn-sm relative"
            :class="isMatch('/notify') ? 'bg-white/[0.08] ring-1 ring-white/10' : ''"
            aria-label="Announcements"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span v-if="notifyUnread > 0" class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />
          </RouterLink>

          <RouterLink
            to="/groups"
            class="btn btn-ghost btn-sm relative"
            :class="isMatch('/groups') ? 'bg-white/[0.08] ring-1 ring-white/10' : ''"
            aria-label="Study Groups"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span v-if="groupPending > 0" class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />
          </RouterLink>

          <RouterLink
            to="/profile"
            class="chip hover:bg-white/[0.06]"
            :class="isMatch('/profile') ? 'ring-1 ring-white/10 bg-white/[0.06]' : ''"
            :aria-current="isMatch('/profile') ? 'page' : undefined"
          >
            <span class="h-2 w-2 rounded-full bg-accent" />
            <span class="max-w-[160px] truncate">{{ auth.user?.fullName || 'Student' }}</span>
          </RouterLink>
        </div>
      </div>
    </header>

    <!-- Main -->
    <div class="container-app py-5 sm:py-7">
      <RouterView />
    </div>

    <!-- Mobile bottom nav -->
    <nav
      class="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-stroke/70 bg-surface/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div class="container-app h-[74px] grid grid-cols-6 gap-2 items-center">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="item.match() ? 'nav-item--active' : ''"
          :aria-current="item.match() ? 'page' : undefined"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path :d="iconPath(item.key)" />
          </svg>
          <span class="leading-none">{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
