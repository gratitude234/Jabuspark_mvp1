<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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

const helperText = computed(() => {
  return isLogin.value
    ? 'Sign in to continue your progress across all JABU study resources.'
    : 'Create an account to save progress, bookmarks, and practice stats.'
})

const ids = {
  fullName: 'fullName',
  email: 'email',
  password: 'password'
}

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

  // Lightweight client checks (keep your backend as source of truth)
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
    // Keep server message if present, but avoid leaking weird objects
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
  // Optional: keep fields when switching; if you prefer reset on switch, uncomment:
  // form.fullName = ''; form.email = ''; form.password = '';

  await nextTick()
  const firstId = isRegister.value ? ids.fullName : ids.email
  document.getElementById(firstId)?.focus?.()
})
</script>

<template>
  <main class="mx-auto w-full max-w-md px-4 py-10">
    <!-- Brand -->
    <header class="flex flex-col items-center text-center">
      <LogoMark variant="lockup" :size="12" alt="JabuSpark" />
      <p class="sub mt-2">Study smarter at JABU.</p>
    </header>

    <!-- Card -->
    <section class="mt-6 rounded-2xl border border-base-200 bg-base-100 p-6 shadow-sm">
      <!-- Mode switch (segmented control) -->
      <div class="mb-6 flex rounded-xl bg-base-200 p-1">
        <button
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'login' ? 'bg-base-100 shadow-sm' : 'opacity-70 hover:opacity-100'"
          :disabled="busy"
          @click="setMode('login')"
        >
          Sign in
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'register' ? 'bg-base-100 shadow-sm' : 'opacity-70 hover:opacity-100'"
          :disabled="busy"
          @click="setMode('register')"
        >
          Create account
        </button>
      </div>

      <div class="text-center">
        <h1 class="h1">{{ title }}</h1>
        <p class="sub mt-2">{{ helperText }}</p>
      </div>

      <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
        <!-- Form-level error -->
        <div v-if="errors.form" class="alert alert-danger" role="alert">
          {{ errors.form }}
        </div>

        <!-- Full name (register only) -->
        <Transition name="fade" mode="out-in">
          <div v-if="mode === 'register'" key="fullName">
            <label class="label" :for="ids.fullName">Full name</label>
            <AppInput
              :id="ids.fullName"
              v-model="form.fullName"
              placeholder="e.g. Gratitude A."
              autocomplete="name"
              :ariaInvalid="!!errors.fullName"
              :aria-describedby="errors.fullName ? `${ids.fullName}-error` : `${ids.fullName}-help`"
            />
            <p :id="`${ids.fullName}-help`" class="help">Use the name you want on your profile.</p>
            <p v-if="errors.fullName" :id="`${ids.fullName}-error`" class="mt-1 text-sm text-error">
              {{ errors.fullName }}
            </p>
          </div>
        </Transition>

        <!-- Email -->
        <div>
          <label class="label" :for="ids.email">Email</label>
          <AppInput
            :id="ids.email"
            v-model="form.email"
            type="email"
            placeholder="you@school.edu"
            autocomplete="email"
            inputmode="email"
            :ariaInvalid="!!errors.email"
            :aria-describedby="errors.email ? `${ids.email}-error` : `${ids.email}-help`"
          />
          <p :id="`${ids.email}-help`" class="help">We’ll never share your email.</p>
          <p v-if="errors.email" :id="`${ids.email}-error`" class="mt-1 text-sm text-error">
            {{ errors.email }}
          </p>
        </div>

        <!-- Password -->
        <div>
          <div class="flex items-center justify-between">
            <label class="label" :for="ids.password">Password</label>

            <!-- Optional: add a real route if you have it -->
            <RouterLink
              v-if="mode === 'login'"
              to="/forgot-password"
              class="text-sm opacity-80 hover:opacity-100"
            >
              Forgot password?
            </RouterLink>
          </div>

          <div class="flex gap-2">
            <AppInput
              :id="ids.password"
              v-model="form.password"
              class="flex-1"
              :type="showPass ? 'text' : 'password'"
              placeholder="••••••••"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              :ariaInvalid="!!errors.password"
              :aria-describedby="errors.password ? `${ids.password}-error` : `${ids.password}-help`"
            />
            <button
              class="btn btn-ghost btn-sm px-4"
              type="button"
              :disabled="busy"
              @click="showPass = !showPass"
              :aria-pressed="showPass"
              :aria-label="showPass ? 'Hide password' : 'Show password'"
            >
              {{ showPass ? 'Hide' : 'Show' }}
            </button>
          </div>

          <p :id="`${ids.password}-help`" class="help">Minimum 6 characters.</p>
          <p v-if="errors.password" :id="`${ids.password}-error`" class="mt-1 text-sm text-error">
            {{ errors.password }}
          </p>
        </div>

        <AppButton class="w-full" :disabled="busy" type="submit">
          <span v-if="!busy">{{ actionText }}</span>
          <span v-else class="inline-flex items-center gap-2">
            <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
            Working…
          </span>
        </AppButton>

        <!-- Small legal / reassurance text -->
        <p v-if="mode === 'register'" class="mt-2 text-center text-sm opacity-70">
          By creating an account, you agree to our Terms and Privacy Policy.
        </p>
      </form>
    </section>
  </main>
</template>

<style scoped>
/* Simple transition (works with the Transition above) */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 160ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
