<script setup>
import { computed, ref, watch } from 'vue'
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

const isLogin = computed(() => mode.value === 'login')
const heading = computed(() => (isLogin.value ? 'Welcome back' : 'Create your account'))
const sub = computed(() =>
  isLogin.value
    ? 'Log in to continue your streak and saved items.'
    : 'Sign up to start practising and saving materials.'
)

watch(
  () => auth.isAuthed,
  (ok) => {
    if (!ok) return
    // If profile incomplete, go onboarding; otherwise dashboard/home.
    router.replace(auth.needsOnboarding ? '/onboarding' : '/')
  },
  { immediate: true }
)

function toggleMode() {
  error.value = ''
  mode.value = isLogin.value ? 'register' : 'login'
}

async function submit() {
  error.value = ''
  const e = (email.value || '').trim().toLowerCase()
  const p = (password.value || '').trim()
  const n = (fullName.value || '').trim()

  if (!e) return (error.value = 'Email is required.')
  if (!p) return (error.value = 'Password is required.')
  if (!isLogin.value && !n) return (error.value = 'Full name is required.')
  if (p.length < 6) return (error.value = 'Password must be at least 6 characters.')

  busy.value = true
  try {
    if (isLogin.value) {
      await auth.login({ email: e, password: p })
    } else {
      await auth.register({ fullName: n, email: e, password: p })
    }
    // redirect handled by watcher
  } catch (err) {
    error.value = err?.message || 'Something went wrong. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="max-w-[480px] mx-auto">
      <div class="flex items-center justify-center mb-6">
        <LogoMark class="h-10 w-10" />
      </div>

      <div class="text-center">
        <div class="h1">{{ heading }}</div>
        <p class="sub mt-2">{{ sub }}</p>
      </div>

      <div class="mt-6 card card-pad">
        <div v-if="!isLogin" class="mb-3">
          <label class="label" for="fullname">Full name</label>
          <AppInput id="fullname" v-model="fullName" placeholder="Your name" autocomplete="name" />
        </div>

        <div class="mb-3">
          <label class="label" for="email">Email</label>
          <AppInput id="email" v-model="email" placeholder="you@example.com" autocomplete="email" />
        </div>

        <div class="mb-2">
          <label class="label" for="password">Password</label>
          <div class="flex gap-2">
            <AppInput
              id="password"
              v-model="password"
              :type="showPass ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="current-password"
            />
            <button type="button" class="btn btn-ghost whitespace-nowrap" @click="showPass = !showPass">
              {{ showPass ? 'Hide' : 'Show' }}
            </button>
          </div>
          <p class="help">Minimum 6 characters.</p>
        </div>

        <div v-if="error" class="alert alert-warn mt-3" role="alert">{{ error }}</div>

        <div class="mt-4 flex flex-col gap-2">
          <AppButton :disabled="busy" @click="submit">
            <span v-if="!busy">{{ isLogin ? 'Log in' : 'Create account' }}</span>
            <span v-else>Please wait…</span>
          </AppButton>

          <button type="button" class="btn btn-ghost" :disabled="busy" @click="toggleMode">
            {{ isLogin ? 'New here? Create an account' : 'Already have an account? Log in' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
