<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Preview' },
  url: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const canShow = computed(() => !!props.url)
const closeBtn = ref(null)

function close() { emit('close') }

function onKey(e) {
  if (e.key === 'Escape') close()
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  closeBtn.value?.focus?.()
})

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[100]">
        <button
          class="absolute inset-0 bg-black/70"
          @click="close"
          aria-label="Close preview"
        />

        <div
          class="absolute inset-x-0 top-0 mx-auto w-full max-w-5xl p-3 sm:p-5"
          :style="{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }"
        >
          <div
            class="card overflow-hidden"
            role="dialog"
            aria-modal="true"
            :aria-label="title"
          >
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

              <object
                v-else
                :data="url"
                type="application/pdf"
                class="w-full h-[72vh] sm:h-[80vh]"
              >
                <div class="p-4 text-sm text-text-2">
                  Your browser can’t preview this PDF.
                  <a class="underline text-accent font-semibold" :href="url" target="_blank" rel="noreferrer">Open</a>.
                </div>
              </object>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 180ms ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
