<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const auth = useAuthStore()

const busy = ref(false)
const error = ref('')
const ok = ref('')

async function configure() {
  busy.value = true
  error.value = ''
  ok.value = ''
  try {
    // Nursing 200L is the only department fully wired for now
    await auth.updateProfile({
      facultyId: 'cophas',
      departmentId: 'nur',
      level: 200,
      // courseIds omitted: backend will auto-add all dept+level courses
    })
    ok.value = 'Setup complete!'
    router.replace('/practice')
  } catch (e) {
    error.value = e?.message || 'Failed to complete Nursing setup.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppCard class="max-w-2xl mx-auto">
      <div class="row">
        <div>
          <div class="kicker">Onboarding</div>
          <div class="h1 mt-1">200L Nursing setup</div>
          <p class="sub mt-2 max-w-[62ch]">
            <b>Only Nursing (200 Level)</b> is available for department-specific content right now.
            If you’re not Nursing, you can still start with <b>GNS Exam Prep</b>.
          </p>
        </div>
        <RouterLink to="/onboarding" class="btn btn-ghost">Back</RouterLink>
      </div>

      <div class="divider my-5" />

      <div v-if="busy" class="alert alert-ok" role="status">
        Setting up your Nursing profile…
      </div>

      <div v-if="ok" class="alert alert-ok mt-3" role="status">{{ ok }}</div>
      <div v-if="error" class="alert alert-danger mt-3" role="alert">{{ error }}</div>

      <div class="mt-5 flex flex-col sm:flex-row gap-2">
        <AppButton class="w-full sm:w-auto" :disabled="busy" @click="configure">
          <span v-if="!busy">Continue with Nursing 200L</span>
          <span v-else>Setting up…</span>
        </AppButton>

        <RouterLink to="/onboarding/gns" class="btn btn-ghost w-full sm:w-auto">
          Use GNS instead
        </RouterLink>
      </div>

      <p class="help mt-3">
        Note: if you see an error about missing courses, confirm Nursing 200L courses exist in your DB.
      </p>
    </AppCard>
  </div>
</template>
