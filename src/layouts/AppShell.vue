<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LogoMark from '../components/LogoMark.vue'

const route = useRoute()
const auth = useAuthStore()

const isMatch = (prefix) => {
  const p = route.path || ''
  return p === prefix || p.startsWith(prefix + '/') || p.startsWith(prefix)
}

const firstName = computed(() => {
  const full = String(auth.user?.fullName || 'Student').trim()
  const first = full.split(/\s+/)[0]
  return first || 'Student'
})

const desktopNavItems = computed(() => [
  { key: 'practice', label: 'Practice', to: '/practice', match: () => isMatch('/practice') },
  { key: 'review', label: 'Review', to: '/practice/review', match: () => isMatch('/practice/review') },
  { key: 'pastq', label: 'PastQ', to: '/past-questions', match: () => isMatch('/past-questions') },
  { key: 'saved', label: 'Saved', to: '/saved', match: () => isMatch('/saved') },
  { key: 'progress', label: 'Progress', to: '/progress', match: () => isMatch('/progress') },
])

const mobileNavItems = computed(() => [
  { key: 'practice', label: 'Practice', to: '/practice', match: () => isMatch('/practice') },
  { key: 'review', label: 'Review', to: '/practice/review', match: () => isMatch('/practice/review') },
  { key: 'pastq', label: 'PastQ', to: '/past-questions', match: () => isMatch('/past-questions') },
  { key: 'saved', label: 'Saved', to: '/saved', match: () => isMatch('/saved') },
  { key: 'progress', label: 'Progress', to: '/progress', match: () => isMatch('/progress') },
  { key: 'profile', label: 'Profile', to: '/profile', match: () => isMatch('/profile') },
])

const desktopLinkClass = (active) => [
  'text-sm font-semibold transition',
  'px-1 py-2',
  'border-b-2',
  active ? 'text-text border-accent' : 'text-text-2 border-transparent hover:text-text hover:border-white/10',
].join(' ')

function iconPath(key) {
  switch (key) {
    case 'practice':
      return 'M5 4h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z'
    case 'review':
      return 'M4 4h16v12H7l-3 3V4Z'
    case 'pastq':
      return 'M7 3h10a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z'
    case 'saved':
      return 'M6 3h12a2 2 0 0 1 2 2v18l-8-4-8 4V5a2 2 0 0 1 2-2Z'
    case 'progress':
      return 'M4 19V5M10 19V9M16 19V13M22 19V7'
    case 'profile':
      return 'M20 21a8 8 0 1 0-16 0'
    default:
      return 'M4 4h16v16H4z'
  }
}
</script>

<template>
  <div class="min-h-dvh pb-[calc(86px+env(safe-area-inset-bottom))] sm:pb-0">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 btn btn-ghost btn-sm"
    >
      Skip to content
    </a>

    <header class="sticky top-0 z-40 border-b border-stroke/70 bg-surface/70 backdrop-blur-xl">
      <div class="container-app h-14 flex items-center justify-between gap-3">
        <RouterLink to="/practice" class="flex items-center gap-2 hover:opacity-90" aria-label="Go to practice">
          <LogoMark variant="auto" :mobile="9" :desktop="11" alt="JabuStudyHub" />
        </RouterLink>

        <nav class="hidden md:flex items-center gap-6" aria-label="Primary">
          <RouterLink
            v-for="item in desktopNavItems"
            :key="item.to"
            :to="item.to"
            :class="desktopLinkClass(item.match())"
            :aria-current="item.match() ? 'page' : undefined"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="flex items-center gap-2">
          <RouterLink
            to="/profile"
            class="chip hidden sm:inline-flex hover:bg-white/[0.06]"
            :class="isMatch('/profile') ? 'ring-1 ring-white/10 bg-white/[0.06]' : ''"
            :aria-current="isMatch('/profile') ? 'page' : undefined"
          >
            <span class="h-2 w-2 rounded-full bg-accent" />
            <span class="max-w-[140px] truncate">{{ firstName }}</span>
          </RouterLink>
        </div>
      </div>
    </header>

    <div id="main" tabindex="-1" class="container-app py-5 sm:py-7">
      <RouterView />
    </div>

    <nav
      class="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-stroke/70 bg-surface/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div class="container-app h-[74px] grid grid-cols-6 gap-2 items-center">
        <RouterLink
          v-for="item in mobileNavItems"
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
