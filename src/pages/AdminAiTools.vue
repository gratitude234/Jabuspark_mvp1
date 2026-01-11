<script setup>
import { computed, onMounted, ref } from 'vue'
import AppCard from '../components/AppCard.vue'
import { useContentStore } from '../stores/content'
import { useCatalogStore } from '../stores/catalog'
import { apiFetch } from '../utils/api'
import { toast } from '../utils/toast'

const content = useContentStore()
const catalog = useCatalogStore()

const courses = computed(() => catalog.courses || [])
const banks = computed(() => content.banks || [])

const courseId = ref('')
const bankId = ref('')
const limit = ref(20)

// Existing tool: MCQ explanations
const mode = ref('full') // hint | full

const selectedBank = computed(() => banks.value.find(b => String(b.id) === String(bankId.value)) || null)
const bankMode = computed(() => String(selectedBank.value?.mode || 'mcq').toLowerCase())

const busy = ref(false)
const msg = ref('')
const err = ref('')

// Quality audit
const auditUseAi = ref(false)
const audit = ref(null)

const auditIssues = computed(() => {
  const items = audit.value?.items
  if (!Array.isArray(items)) return []
  return items
    .filter(i => Array.isArray(i.flags) && i.flags.length)
    .map(i => ({
      ...i,
      severityRank: Math.max(
        ...i.flags.map(f => (f.severity === 'high' ? 3 : f.severity === 'medium' ? 2 : 1))
      )
    }))
    .sort((a, b) => (b.severityRank || 0) - (a.severityRank || 0))
})

onMounted(async () => {
  await Promise.allSettled([
    catalog.fetchCourses(),
    content.fetchBanks(),
  ])
})

async function loadBanks() {
  if (!courseId.value) return
  try {
    await content.fetchBanks({ courseId: courseId.value })
    bankId.value = ''
    audit.value = null
  } catch {
    // ignore
  }
}

function normalizeLimit() {
  const n = Number(limit.value || 20)
  if (!Number.isFinite(n)) return 20
  return Math.max(1, Math.min(50, Math.round(n)))
}

async function runFillExplanations() {
  if (!bankId.value) return toast('Pick a bank', 'warn')

  busy.value = true
  err.value = ''
  msg.value = ''
  audit.value = null

  try {
    const res = await apiFetch('/admin/ai/fill-explanations', {
      method: 'POST',
      body: { bankId: bankId.value, mode: mode.value, limit: normalizeLimit() },
    })

    const updated = res?.data?.updated ?? 0
    const total = res?.data?.totalRequested ?? 0
    msg.value = `Filled explanations for ${updated} / ${total} questions.`
    toast('Done', 'ok')
  } catch (e) {
    err.value = e?.message || 'Failed'
    toast(err.value, 'warn')
  } finally {
    busy.value = false
  }
}

async function runFillTheoryGuides() {
  if (!bankId.value) return toast('Pick a bank', 'warn')
  if (bankMode.value !== 'theory') return toast('Select a theory bank', 'warn')

  busy.value = true
  err.value = ''
  msg.value = ''
  audit.value = null

  try {
    const res = await apiFetch('/admin/ai/fill-theory-guides', {
      method: 'POST',
      body: { bankId: bankId.value, limit: normalizeLimit() },
    })

    const updatedQuestions = res?.data?.updatedQuestions ?? 0
    const total = res?.data?.totalRequested ?? 0
    msg.value = `Generated guides/points for ${updatedQuestions} / ${total} theory questions.`
    toast('Done', 'ok')
  } catch (e) {
    err.value = e?.message || 'Failed'
    toast(err.value, 'warn')
  } finally {
    busy.value = false
  }
}

async function runQualityAudit() {
  if (!bankId.value) return toast('Pick a bank', 'warn')

  busy.value = true
  err.value = ''
  msg.value = ''
  audit.value = null

  try {
    const res = await apiFetch('/admin/ai/quality-audit', {
      method: 'POST',
      body: {
        bankId: bankId.value,
        limit: normalizeLimit(),
        useAi: !!auditUseAi.value,
      },
    })

    audit.value = res?.data || null

    const s = audit.value?.summary
    if (s) {
      msg.value = `Audit done: ${s.withIssues || 0}/${s.total || 0} questions have issues. (high=${s.high || 0}, medium=${s.medium || 0}, low=${s.low || 0})`
      if (audit.value?.useAi) msg.value += ' • AI review enabled'
      if (audit.value?.cached) msg.value += ' • cached'
    } else {
      msg.value = 'Audit done.'
    }

    toast('Done', 'ok')
  } catch (e) {
    err.value = e?.message || 'Failed'
    toast(err.value, 'warn')
  } finally {
    busy.value = false
  }
}

function flagClass(sev) {
  const s = String(sev || '').toLowerCase()
  if (s === 'high') return 'chip chip-danger'
  if (s === 'medium') return 'chip chip-warn'
  return 'chip'
}
</script>

<template>
  <div class="page pb-28 space-y-3">
    <AppCard>
      <div class="h1">Admin AI Tools</div>
      <p class="sub mt-1">Generate explanations, theory guides/points, and run quality audits.</p>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label">Course</label>
          <select v-model="courseId" class="input h-11" @change="loadBanks">
            <option value="">Select…</option>
            <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.code }} — {{ c.title }}</option>
          </select>
        </div>

        <div>
          <label class="label">Bank</label>
          <select v-model="bankId" class="input h-11">
            <option value="">Select…</option>
            <option v-for="b in banks" :key="b.id" :value="b.id">
              {{ b.title }} ({{ String(b.mode || 'mcq').toUpperCase() }})
            </option>
          </select>
          <div v-if="selectedBank" class="mt-1 text-xs text-text-3">
            Selected mode: <b>{{ bankMode }}</b>
          </div>
        </div>

        <div>
          <label class="label">Limit (max 50)</label>
          <input v-model.number="limit" type="number" min="1" max="50" class="input h-11" />
          <div class="mt-1 text-xs text-text-3">Controls how many questions the tool processes per run.</div>
        </div>

        <div>
          <label class="label">MCQ explanation mode</label>
          <select v-model="mode" class="input h-11">
            <option value="full">Full explanation</option>
            <option value="hint">Hint only</option>
          </select>
          <div class="mt-1 text-xs text-text-3">Used only for “Fill MCQ explanations”.</div>
        </div>

        <div class="sm:col-span-2">
          <label class="label">Quality audit options</label>
          <div class="flex flex-wrap items-center gap-4">
            <label class="text-sm flex items-center gap-2 select-none">
              <input type="checkbox" v-model="auditUseAi" />
              Use AI review (costs quota)
            </label>
          </div>
          <div class="mt-1 text-xs text-text-3">
            Deterministic checks always run. AI review adds subjective checks (ambiguity, multiple-correct, etc.).
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-2 sm:flex sm:flex-wrap">
        <button class="btn btn-primary btn-sm h-11" :disabled="busy || !bankId" @click="runFillExplanations">
          {{ busy ? 'Working…' : 'Fill MCQ explanations' }}
        </button>

        <button class="btn btn-ghost btn-sm h-11" :disabled="busy || !bankId || bankMode !== 'theory'" @click="runFillTheoryGuides">
          {{ busy ? 'Working…' : 'Generate theory guides/points' }}
        </button>

        <button class="btn btn-ghost btn-sm h-11" :disabled="busy || !bankId" @click="runQualityAudit">
          {{ busy ? 'Working…' : 'Quality audit' }}
        </button>
      </div>

      <div v-if="err" class="alert alert-warn mt-4" role="alert">{{ err }}</div>
      <div v-else-if="msg" class="alert mt-4" role="alert">{{ msg }}</div>

      <div v-if="audit" class="mt-4 card card-pad">
        <div class="text-sm font-semibold">Audit summary</div>
        <div class="mt-2 flex flex-wrap gap-2">
          <span class="chip">Total: {{ audit.summary?.total || 0 }}</span>
          <span class="chip chip-danger">High: {{ audit.summary?.high || 0 }}</span>
          <span class="chip chip-warn">Medium: {{ audit.summary?.medium || 0 }}</span>
          <span class="chip">Low: {{ audit.summary?.low || 0 }}</span>
          <span v-if="audit.useAi" class="chip">AI on</span>
          <span v-if="audit.cached" class="chip">cached</span>
        </div>

        <div v-if="auditIssues.length" class="mt-4">
          <div class="text-sm font-semibold">Issues (top {{ Math.min(15, auditIssues.length) }})</div>
          <p class="sub mt-1">These are flags to review, not automatic fixes.</p>

          <div class="mt-3 grid gap-2">
            <div v-for="it in auditIssues.slice(0, 15)" :key="it.id" class="rounded-xl border border-border/70 bg-white/5 p-3">
              <div class="text-xs font-semibold">{{ it.id }}</div>
              <div class="mt-1 text-sm whitespace-pre-line">{{ it.prompt }}</div>

              <div v-if="it.flags?.length" class="mt-2 flex flex-wrap gap-2">
                <span v-for="(f, i) in it.flags" :key="i" :class="flagClass(f.severity)">
                  {{ String(f.severity || 'low').toUpperCase() }} — {{ f.type }}
                </span>
              </div>

              <ul v-if="it.flags?.length" class="mt-2 list-disc pl-5 text-sm">
                <li v-for="(f, i) in it.flags" :key="'m'+i">
                  <span class="opacity-70" v-if="f.source">[{{ f.source }}]</span>
                  {{ f.message }}
                </li>
              </ul>

              <div v-if="it.suggestedFix" class="mt-2 text-sm">
                <div class="text-xs font-semibold opacity-80">Suggested fix</div>
                <div class="mt-1 whitespace-pre-line">{{ it.suggestedFix }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="mt-3 sub">
          No issues reported in the audited sample.
        </div>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
.chip {
  padding: 0.35rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  line-height: 1rem;
  background: rgba(0, 0, 0, 0.06);
}
.chip-warn {
  background: rgba(245, 158, 11, 0.15);
}
.chip-danger {
  background: rgba(239, 68, 68, 0.15);
}
</style>
