<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { useContentStore } from '../stores/content'
import { apiFetch } from '../utils/api'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppInput from '../components/AppInput.vue'
import AppButton from '../components/AppButton.vue'

const auth = useAuthStore()
const catalog = useCatalogStore()
const content = useContentStore()

const courseId = ref('')
const bankId = ref('')
const limit = ref(20)

const busy = ref(false)
const error = ref('')
const ok = ref('')

const courseOptions = computed(() => [
  { value: '', label: 'All courses' },
  ...(catalog.courses || []).map(c => ({ value: c.id, label: `${c.code} — ${c.title} (${c.level})` })),
])

const bankOptions = computed(() => [
  { value: '', label: 'Select a bank' },
  ...(content.banks || []).map(b => ({ value: b.id, label: `${b.title || b.id}` })),
])

async function loadBanks() {
  bankId.value = ''
  await content.fetchBanks({ courseId: courseId.value || '' })
}

async function runFill() {
  error.value = ''
  ok.value = ''
  if (!bankId.value) {
    error.value = 'Select a bank first.'
    return
  }
  busy.value = true
  try {
    const res = await apiFetch('/admin/ai/fill-explanations', {
      method: 'POST',
      body: { bankId: bankId.value, limit: Number(limit.value) || 20 }
    })
    const data = res?.data
    ok.value = `Updated ${data?.updated || 0} explanations (requested ${data?.totalRequested || 0}).`
  } catch (e) {
    error.value = e?.message || 'Failed to run AI tool.'
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  if (auth.user?.role !== 'admin') return
  await catalog.bootstrap()
  await catalog.fetchCourses()
  await loadBanks()
})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="h1">AI Tools</div>
          <p class="sub mt-1">Admin-only tools to speed up content quality.</p>
        </div>
      </div>

      <div class="divider my-4" />

      <div class="grid gap-3 sm:grid-cols-3">
        <div>
          <label class="label">Course (optional)</label>
          <AppSelect v-model="courseId" :options="courseOptions" />
        </div>
        <div>
          <label class="label">Bank</label>
          <AppSelect v-model="bankId" :options="bankOptions" />
        </div>
        <div>
          <label class="label">Max questions this run</label>
          <AppInput v-model="limit" type="number" min="1" max="50" />
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <AppButton class="w-full sm:w-auto" :disabled="busy" @click="loadBanks">Load banks</AppButton>
        <AppButton class="w-full sm:w-auto" :disabled="busy" @click="runFill">Fill missing explanations</AppButton>
      </div>

      <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
      <div v-if="ok" class="alert alert-success mt-4" role="status">{{ ok }}</div>

      <div class="mt-4 sub">
        Tip: Run this after you import questions that have empty explanations. It updates only missing ones.
      </div>
    </AppCard>
  </div>
</template>
