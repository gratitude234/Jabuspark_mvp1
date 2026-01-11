<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAiStore } from '../stores/ai'

const props = defineProps({
  docType: { type: String, default: '' },
  docId: { type: String, default: '' },
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Preview' },
  url: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const ai = useAiStore()
const showAi = ref(false)
const aiQ = ref('')
const aiA = ref('')
const aiSources = ref([])
const aiBusy = ref(false)
const aiErr = ref('')
const aiModel = ref('')
const aiCached = ref(false)

async function askAi() {
  aiErr.value = ''
  aiA.value = ''
  aiSources.value = []
  aiModel.value = ''
  aiCached.value = false

  const q = (aiQ.value || '').trim()
  if (!q) return (aiErr.value = 'Type a question first.')

  aiBusy.value = true
  try {
    const data = await ai.docChat({ docType: props.docType, docId: props.docId, question: q })
    aiA.value = data?.answer || ''
    aiSources.value = Array.isArray(data?.sources) ? data.sources : []
    aiModel.value = data?.model || ''
    aiCached.value = !!data?.cached
  } catch (e) {
    aiErr.value = e?.message || 'AI failed.'
  } finally {
    aiBusy.value = false
  }
}

const canShow = computed(() => !!props.url)
const closeBtn = ref(null)

function close() {
  emit('close')
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    await nextTick()
    closeBtn.value?.focus?.()
  }
)

watch(
  () => [props.docType, props.docId],
  () => {
    // Reset AI pane when switching documents
    aiQ.value = ''
    aiA.value = ''
    aiSources.value = []
    aiErr.value = ''
    aiModel.value = ''
    aiCached.value = false
    showAi.value = false
  }
)

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[100] overflow-y-auto">
        <button class="absolute inset-0 bg-black/70" @click="close" aria-label="Close preview" />

        <div
          class="relative mx-auto w-full max-w-5xl p-3 sm:p-5 pb-6"
          :style="{ paddingTop: 'calc(12px + env(safe-area-inset-top))', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }"
        >
          <div class="card overflow-hidden" role="dialog" aria-modal="true" :aria-label="title">
            <div class="flex items-center justify-between gap-3 border-b border-white/10 bg-surface/70 px-4 py-3">
              <div class="min-w-0">
                <div class="text-sm font-bold truncate">{{ title }}</div>
                <div class="text-xs text-text-3 truncate">{{ url }}</div>
              </div>
              <div class="flex items-center gap-2">
                <a
                  v-if="url"
                  class="btn btn-ghost btn-sm"
                  :href="url"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open in new tab"
                >
                  Open
                </a>
                <button ref="closeBtn" class="btn btn-ghost btn-sm" @click="close">Close</button>
              </div>
            </div>

            <div class="bg-surface-2">
              <div v-if="!canShow" class="p-6 text-sm text-text-2">No file to preview.</div>

              <object v-else :data="url" type="application/pdf" class="w-full h-[60vh] sm:h-[72vh]">
                <div class="p-4 text-sm text-text-2">
                  Your browser can’t preview this PDF.
                  <a class="underline text-accent font-semibold" :href="url" target="_blank" rel="noreferrer">Open</a>.
                </div>
              </object>

              <div v-if="docType && docId" class="p-4">
                <div class="rounded-2xl border border-border/70 bg-surface/60 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="text-sm font-semibold">Ask AI about this material</div>
                      <p class="sub mt-1">Now uses chunking/RAG, so answers come from the most relevant part of the PDF.</p>
                    </div>
                    <button class="btn btn-ghost btn-sm" @click="showAi = !showAi">{{ showAi ? 'Hide' : 'Ask AI' }}</button>
                  </div>

                  <div v-if="showAi" class="mt-3 grid gap-2">
                    <textarea
                      v-model="aiQ"
                      class="input min-h-[90px] resize-y"
                      placeholder="e.g., What are the main causes of inflation mentioned in this PDF?"
                    />
                    <div class="flex flex-wrap items-center gap-2">
                      <button class="btn btn-sm" :disabled="aiBusy" @click="askAi">
                        <span v-if="!aiBusy">Ask</span>
                        <span v-else>Thinking…</span>
                      </button>
                      <span v-if="aiErr" class="text-sm text-danger">{{ aiErr }}</span>
                    </div>

                    <div v-if="aiA" class="mt-2 rounded-xl border border-border/70 bg-white/5 p-3">
                      <div class="flex items-center justify-between gap-2">
                        <div class="text-xs font-semibold opacity-80">Answer</div>
                        <div v-if="aiModel" class="text-xs opacity-70">
                          {{ aiModel }}<span v-if="aiCached"> • cached</span>
                        </div>
                      </div>
                      <div class="mt-1 whitespace-pre-line text-sm">{{ aiA }}</div>

                      <div v-if="aiSources && aiSources.length" class="mt-3">
                        <div class="text-xs font-semibold opacity-80">Used excerpts</div>
                        <ol class="mt-1 list-decimal pl-5 text-xs text-text-2">
                          <li v-for="s in aiSources" :key="String(s.snippet || s.chunkIndex || s.excerpt).slice(0, 40)" class="mb-2">
                            <div class="font-semibold">
                              Snippet {{ s.snippet ?? '?' }}
                              <span v-if="s.chunkIndex" class="opacity-70">(chunk {{ s.chunkIndex }})</span>
                            </div>
                            <div class="whitespace-pre-line">{{ s.excerpt }}</div>
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 180ms ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
