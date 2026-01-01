<script setup>
import { computed, nextTick, reactive, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import AppInput from '../components/AppInput.vue'
import AppButton from '../components/AppButton.vue'
import LogoMark from '../components/LogoMark.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref('login') // 'login' | 'register'
const showPass = ref(false)
const busy = ref(false)
const rememberMe = ref(true)

const form = reactive({
  fullName: '',
  email: '',
  password: ''
})

const errors = reactive({
  fullName: '',
  email: '',
  password: '',
  form: ''
})

const isLogin = computed(() => mode.value === 'login')
const isRegister = computed(() => mode.value === 'register')

const title = computed(() => (isLogin.value ? 'Welcome back' : 'Create your account'))
const actionText = computed(() => (isLogin.value ? 'Sign in' : 'Create account'))

const helperText = computed(() =>
  isLogin.value
    ? 'Sign in to continue your progress across all JABU study resources.'
    : 'Create an account to save progress, bookmarks, and practice stats.'
)

const ids = {
  fullName: 'fullName',
  email: 'email',
  password: 'password'
}

const pillStyle = computed(() => ({
  transform: mode.value === 'login' ? 'translateX(0%)' : 'translateX(100%)'
}))

function clearErrors() {
  errors.fullName = ''
  errors.email = ''
  errors.password = ''
  errors.form = ''
}

function validate() {
  clearErrors()

  const e = (form.email || '').trim().toLowerCase()
  const p = (form.password || '').trim()
  const n = (form.fullName || '').trim()

  if (!e) errors.email = 'Email is required.'
  else if (!/^\S+@\S+\.\S+$/.test(e)) errors.email = 'Enter a valid email address.'

  if (!p) errors.password = 'Password is required.'
  else if (p.length < 6) errors.password = 'Password must be at least 6 characters.'

  if (isRegister.value && !n) errors.fullName = 'Full name is required.'

  return !(errors.fullName || errors.email || errors.password)
}

async function submit() {
  if (busy.value) return
  errors.form = ''

  const ok = validate()
  if (!ok) return

  const payload = {
    fullName: (form.fullName || '').trim(),
    email: (form.email || '').trim().toLowerCase(),
    password: (form.password || '').trim()
  }

  busy.value = true
  try {
    if (isLogin.value) {
      await auth.login({ email: payload.email, password: payload.password })
    } else {
      await auth.register(payload)
    }

    const rawNext = route.query?.next
    const nextPath = typeof rawNext === 'string' && rawNext.startsWith('/') ? rawNext : ''

    if (auth.needsOnboarding) {
      router.push(nextPath ? { path: '/onboarding', query: { next: nextPath } } : '/onboarding')
    } else {
      router.push(nextPath || '/dashboard')
    }
  } catch (err) {
    errors.form = err?.message || 'Authentication failed. Please try again.'
  } finally {
    busy.value = false
  }
}

function setMode(next) {
  if (busy.value) return
  if (mode.value === next) return
  mode.value = next
}

watch(mode, async () => {
  clearErrors()
  showPass.value = false
  await nextTick()
  const firstId = isRegister.value ? ids.fullName : ids.email
  document.getElementById(firstId)?.focus?.()
})

onMounted(() => {
  const firstId = isRegister.value ? ids.fullName : ids.email
  requestAnimationFrame(() => document.getElementById(firstId)?.focus?.())
})
</script>

<template>
  <main class="relative min-h-[100svh]">
    <!-- Background -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute inset-0 bg-base-100" />
      <div class="absolute inset-0 bg-gradient-to-br from-accent/20 via-base-100 to-base-100" />
      <div class="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <div class="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div
        class="absolute inset-0 [background:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)]
               [background-size:22px_22px] opacity-[0.14]"
      />
    </div>

    <div class="relative mx-auto flex min-h-[100svh] w-full max-w-6xl items-center px-4 py-10">
      <section class="grid w-full gap-8 md:grid-cols-2">
        <!-- Left: Brand / value -->
        <aside class="hidden md:flex flex-col justify-center">
          <div class="max-w-lg">
            <div class="flex items-center gap-3">
              <LogoMark variant="mark" :size="10" alt="JabuSpark" />
              <div class="text-lg font-semibold">JabuSpark</div>
            </div>

            <h1 class="mt-6 text-4xl font-bold leading-tight">
              Study smarter.<br />
              Track progress.<br />
              Win exams.
            </h1>

            <p class="mt-4 max-w-[52ch] text-sm opacity-80">
              Everything you need for JABU — past questions, materials, practice banks, and streak-based motivation.
            </p>

            <ul class="mt-7 space-y-3 text-sm opacity-85">
              <li class="flex gap-3">
                <span class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/20">✓</span>
                <span>Practice banks that adapt to your weak areas.</span>
              </li>
              <li class="flex gap-3">
                <span class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/20">✓</span>
                <span>Save bookmarks and keep your revision organized.</span>
              </li>
              <li class="flex gap-3">
                <span class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/20">✓</span>
                <span>See your progress and stay consistent.</span>
              </li>
            </ul>

            <div class="mt-8 rounded-2xl border border-base-200 bg-base-100/60 p-4 backdrop-blur">
              <p class="text-sm">
                <span class="font-semibold">Tip:</span> Use your school email so your account is easier to recover later.
              </p>
            </div>
          </div>
        </aside>

        <!-- Right: Auth card -->
        <div class="flex items-center justify-center">
          <div class="w-full max-w-lg">
            <!-- Mobile brand -->
            <header class="mb-6 flex flex-col items-center text-center md:hidden">
              <LogoMark variant="lockup" :size="12" alt="JabuSpark" />
              <p class="mt-2 text-sm opacity-80">Study smarter at JABU.</p>
            </header>

            <section class="rounded-3xl border border-base-200 bg-base-100/80 p-6 shadow-lg backdrop-blur md:p-8">
              <!-- Segmented control -->
              <div class="relative mb-7 rounded-2xl bg-base-200 p-1">
                <div
                  class="absolute left-1 top-1 h-[calc(100%-0.5rem)] w-[calc(50%-0.25rem)] rounded-xl bg-base-100 shadow-sm transition-transform duration-200"
                  :style="pillStyle"
                  aria-hidden="true"
                />
                <div class="relative flex">
                  <button
                    type="button"
                    class="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
                    :class="mode === 'login' ? 'opacity-100' : 'opacity-70 hover:opacity-100'"
                    :disabled="busy"
                    @click="setMode('login')"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    class="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
                    :class="mode === 'register' ? 'opacity-100' : 'opacity-70 hover:opacity-100'"
                    :disabled="busy"
                    @click="setMode('register')"
                  >
                    Create account
                  </button>
                </div>
              </div>

              <div class="text-center">
                <h2 class="text-2xl font-bold">{{ title }}</h2>
                <p class="mt-2 text-sm opacity-80">{{ helperText }}</p>
              </div>

              <form class="mt-7 space-y-4" novalidate @submit.prevent="submit">
                <div
                  v-if="errors.form"
                  class="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                  role="alert"
                  aria-live="polite"
                >
                  {{ errors.form }}
                </div>

                <Transition name="fade" mode="out-in">
                  <div v-if="mode === 'register'" key="fullName">
                    <label class="mb-1 block text-sm font-semibold opacity-90" :for="ids.fullName">Full name</label>
                    <AppInput
                      :id="ids.fullName"
                      v-model="form.fullName"
                      placeholder="e.g. Gratitude A."
                      autocomplete="name"
                      :disabled="busy"
                      :ariaInvalid="!!errors.fullName"
                      :ariaDescribedby="errors.fullName ? `${ids.fullName}-error` : `${ids.fullName}-help`"
                    />
                    <p :id="`${ids.fullName}-help`" class="mt-1 text-xs opacity-70">
                      Use the name you want on your profile.
                    </p>
                    <p v-if="errors.fullName" :id="`${ids.fullName}-error`" class="mt-1 text-xs text-red-200">
                      {{ errors.fullName }}
                    </p>
                  </div>
                </Transition>

                <div>
                  <label class="mb-1 block text-sm font-semibold opacity-90" :for="ids.email">Email</label>
                  <AppInput
                    :id="ids.email"
                    v-model="form.email"
                    type="email"
                    placeholder="you@school.edu"
                    autocomplete="email"
                    inputmode="email"
                    :disabled="busy"
                    :ariaInvalid="!!errors.email"
                    :ariaDescribedby="errors.email ? `${ids.email}-error` : `${ids.email}-help`"
                  />
                  <p :id="`${ids.email}-help`" class="mt-1 text-xs opacity-70">
                    We’ll never share your email.
                  </p>
                  <p v-if="errors.email" :id="`${ids.email}-error`" class="mt-1 text-xs text-red-200">
                    {{ errors.email }}
                  </p>
                </div>

                <div>
                  <div class="mb-1 flex items-center justify-between">
                    <label class="block text-sm font-semibold opacity-90" :for="ids.password">Password</label>

                    <RouterLink
                      v-if="mode === 'login'"
                      to="/forgot-password"
                      class="text-sm opacity-75 hover:opacity-100"
                    >
                      Forgot password?
                    </RouterLink>
                  </div>

                  <div class="relative">
                    <AppInput
                      :id="ids.password"
                      v-model="form.password"
                      class="pr-20"
                      :type="showPass ? 'text' : 'password'"
                      placeholder="••••••••"
                      :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                      :disabled="busy"
                      :ariaInvalid="!!errors.password"
                      :ariaDescribedby="errors.password ? `${ids.password}-error` : `${ids.password}-help`"
                    />

                    <button
                      type="button"
                      class="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-base-200 bg-base-100/40 px-3 py-1.5 text-xs font-semibold opacity-90 hover:bg-base-100/70"
                      :disabled="busy"
                      @click="showPass = !showPass"
                      :aria-pressed="showPass"
                      :aria-label="showPass ? 'Hide password' : 'Show password'"
                    >
                      {{ showPass ? 'Hide' : 'Show' }}
                    </button>
                  </div>

                  <div class="mt-2 flex items-center justify-between">
                    <p :id="`${ids.password}-help`" class="text-xs opacity-70">
                      Minimum 6 characters.
                    </p>

                    <label v-if="mode === 'login'" class="flex items-center gap-2 text-xs opacity-80 select-none">
                      <input
                        type="checkbox"
                        class="h-4 w-4 accent-current"
                        v-model="rememberMe"
                        :disabled="busy"
                      />
                      Remember me
                    </label>
                  </div>

                  <p v-if="errors.password" :id="`${ids.password}-error`" class="mt-1 text-xs text-red-200">
                    {{ errors.password }}
                  </p>
                </div>

                <AppButton class="w-full" :disabled="busy" type="submit">
                  <span v-if="!busy">{{ actionText }}</span>
                  <span v-else class="inline-flex items-center justify-center gap-2">
                    <span
                      class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/90"
                      aria-hidden="true"
                    />
                    Working…
                  </span>
                </AppButton>

                <p v-if="mode === 'register'" class="pt-1 text-center text-xs opacity-70">
                  By creating an account, you agree to our Terms and Privacy Policy.
                </p>

                <p class="pt-2 text-center text-xs opacity-60">
                  Trouble signing in? Check your email spelling and password.
                </p>
              </form>
            </section>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 160ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
