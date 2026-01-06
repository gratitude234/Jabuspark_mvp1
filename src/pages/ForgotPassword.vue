<script setup>
import { ref } from 'vue'
import AppCard from '../components/AppCard.vue'
import AppInput from '../components/AppInput.vue'
import AppButton from '../components/AppButton.vue'
import LogoMark from '../components/LogoMark.vue'
import { toast } from '../utils/toast'

const email = ref('')
const busy = ref(false)

function submit() {
  // MVP-friendly UX: avoid a dead-end while the reset endpoint is not yet live.
  toast('Password reset isn’t available yet. Please contact your class rep / admin for help.', 'warn')
}
</script>

<template>
  <main class="min-h-dvh flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-md">
      <header class="mb-6 flex flex-col items-center text-center">
        <LogoMark variant="lockup" :size="12" alt="JabuSpark" />
        <p class="mt-2 text-sm text-text-2">Reset your password</p>
      </header>

      <AppCard>
        <div class="h2">Forgot password</div>
        <p class="sub mt-2">
          Enter the email you used for your account. If password reset isn’t available yet, we’ll show the fastest
          workaround.
        </p>

        <form class="mt-5 space-y-4" @submit.prevent="submit">
          <div>
            <label class="label" for="reset-email">Email</label>
            <AppInput
              id="reset-email"
              v-model="email"
              type="email"
              placeholder="you@school.edu"
              autocomplete="email"
              inputmode="email"
              :disabled="busy"
            />
            <p class="help">Use the same email you used during sign up.</p>
          </div>

          <AppButton class="w-full" :disabled="busy">Continue</AppButton>
        </form>

        <div class="divider my-5" />

        <div class="alert alert-warn" role="status">
          Password reset is coming soon. For now, please contact your class rep or the JabuSpark admin team to reset
          your account.
        </div>

        <div class="mt-4 text-center">
          <RouterLink to="/auth/login" class="btn btn-ghost btn-sm">Back to sign in</RouterLink>
        </div>
      </AppCard>
    </div>
  </main>
</template>
