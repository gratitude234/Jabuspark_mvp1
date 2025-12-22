<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import AppInput from '../components/AppInput.vue'
import AppButton from '../components/AppButton.vue'
import LogoMark from '../components/LogoMark.vue'

const auth = useAuthStore()
const router = useRouter()

const mode = ref('login') // 'login' | 'register'
const fullName = ref('')
const email = ref('')
const password = ref('')
const showPass = ref(false)

const busy = ref(false)
const error = ref('')

const title = computed(() => (mode.value === 'login' ? 'Welcome back' : 'Create your account'))
const actionText = computed(() => (mode.value === 'login' ? 'Sign in' : 'Create account'))

const ids = {
  fullName: 'fullName',
  email: 'email',
  password: 'password'
}

const helperText = computed(() => {
  if (mode.value === 'login') return 'Sign in to continue your progress across all JABU study resources.'
  return 'Create an account to save progress, bookmarks, and practice stats.'
})

function toggleMode() {
  error.value = ''
  mode.value = mode.value === 'login' ? 'register' : 'login'
}

async function submit() {
  error.value = ''
  const e = (email.value || '').trim().toLowerCase()
  const p = (password.value || '').trim()
  const n = (fullName.value || '').trim()

  if (!e) return (error.value = 'Email is required.')
  if (!p) return (error.value = 'Password is required.')
  if (p.length < 6) return (error.value = 'Password must be at least 6 characters.')
  if (mode.value === 'register' && !n) return (error.value = 'Full name is required.')

  busy.value = true
  try {
    if (mode.value === 'login') {
      await auth.login({ email: e, password: p })
    } else {
      await auth.register({ fullName: n, email: e, password: p })
    }

    if (auth.needsOnboarding) router.push('/onboarding')
    else router.push('/dashboard')
  } catch (err) {
    error.value = err?.message || 'Authentication failed. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <!-- Brand header -->
    <div class="flex flex-col items-center text-center">
      <LogoMark variant="lockup" :size="12" alt="JabuSpark" />
      <p class="sub mt-2">Study smarter at JABU.</p>
    </div>

    <div class="mt-6">
      <div class="h1 text-center">{{ title }}</div>
      <p class="sub mt-2 text-center">{{ helperText }}</p>
    </div>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <div v-if="mode === 'register'">
        <label class="label" :for="ids.fullName">Full name</label>
        <AppInput
          :id="ids.fullName"
          v-model="fullName"
          placeholder="e.g. Gratitude A."
          autocomplete="name"
          :ariaInvalid="!!error"
          @keyup.enter="submit"
        />
      </div>

      <div>
        <label class="label" :for="ids.email">Email</label>
        <AppInput
          :id="ids.email"
          v-model="email"
          type="email"
          placeholder="you@school.edu"
          autocomplete="email"
          inputmode="email"
          :ariaInvalid="!!error"
          @keyup.enter="submit"
        />
      </div>

      <div>
        <label class="label" :for="ids.password">Password</label>
        <div class="flex gap-2">
          <AppInput
            :id="ids.password"
            v-model="password"
            class="flex-1"
            :type="showPass ? 'text' : 'password'"
            placeholder="••••••••"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            :ariaInvalid="!!error"
            @keyup.enter="submit"
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
        <p class="help">Minimum 6 characters.</p>
      </div>

      <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

      <AppButton class="w-full" :disabled="busy" type="submit">
        <span v-if="!busy">{{ actionText }}</span>
        <span v-else>Working…</span>
      </AppButton>

      <button class="btn btn-ghost w-full" type="button" :disabled="busy" @click="toggleMode">
        <span v-if="mode === 'login'">New here? Create an account</span>
        <span v-else>Already have an account? Sign in</span>
      </button>
    </form>
  </div>
</template>
