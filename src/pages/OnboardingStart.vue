<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const auth = useAuthStore()

const hasSomeSetup = computed(() => {
  const p = auth.user?.profile || {}
  return (p.level || 0) > 0 && (p.courseIds || []).length > 0
})

function go(path) {
  router.push(path)
}
</script>

<template>
  <div class="page">
    <AppCard class="max-w-3xl mx-auto relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/14 via-transparent to-transparent" />
      <div class="relative">
        <div class="text-xs text-text-3">Onboarding</div>
        <div class="h1 mt-1">Choose your first study track</div>

        <p class="sub mt-2 max-w-[70ch]">
          <b>GNS / GST is available for everyone right now</b> — no department needed.
          <br />
          <span class="opacity-90">Department content is being uploaded step-by-step.</span>
          <b class="ml-1">Only 200L Nursing</b> is live for department-specific content for now.
        </p>

        <!-- Clear status banner -->
        <div class="mt-4 grid gap-2 sm:grid-cols-3">
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="text-sm font-bold">✅ Available now</div>
            <div class="text-xs text-text-3 mt-1">GNS / GST Exam Prep (all students)</div>
          </div>
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="text-sm font-bold">✅ Live (Dept)</div>
            <div class="text-xs text-text-3 mt-1">Nursing — 200 Level only</div>
          </div>
          <div class="card card-pad border border-border/70 bg-surface/60">
            <div class="text-sm font-bold">⏳ Coming soon</div>
            <div class="text-xs text-text-3 mt-1">Other departments (join waitlist)</div>
          </div>
        </div>

        <div class="grid gap-3 mt-6 sm:grid-cols-3">
          <button type="button" class="card card-press card-pad text-left" @click="go('/onboarding/gns')">
            <div class="text-sm font-extrabold">GNS Exam Prep (GST)</div>
            <p class="sub mt-1">Start practising GST questions now — no department needed.</p>
            <div class="mt-3"><span class="badge">Recommended</span></div>
          </button>

          <button type="button" class="card card-press card-pad text-left" @click="go('/onboarding/nursing-200')">
            <div class="text-sm font-extrabold">200L Nursing</div>
            <p class="sub mt-1">Fast setup for Nursing (200 Level) — available now.</p>
            <div class="mt-3"><span class="badge bg-accent/15 border-accent/30 text-text">Live</span></div>
          </button>

          <button type="button" class="card card-press card-pad text-left" @click="go('/onboarding/request-department')">
            <div class="text-sm font-extrabold">Request my department</div>
            <p class="sub mt-1">Tell us your department + key courses so we can prioritise content.</p>
            <div class="mt-3"><span class="badge">Waitlist</span></div>
          </button>
        </div>

        <div class="divider my-6" />

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div class="text-xs text-text-3">
            <span v-if="hasSomeSetup">You already have some setup. You can still switch track.</span>
            <span v-else>Tip: if you’re in a hurry, start with <b>GNS Exam Prep</b> first.</span>
          </div>

          <div class="flex gap-2">
            <RouterLink v-if="hasSomeSetup" to="/dashboard" class="btn btn-ghost">Go to dashboard</RouterLink>
            <RouterLink to="/onboarding/department" class="btn btn-ghost">Try department setup</RouterLink>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
