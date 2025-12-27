<script setup>
import { computed } from 'vue'

import lockup from '../assets/logo-lockup.png'
import mark from '../assets/logo-mark.png'

const props = defineProps({
  /** auto: mark on mobile + lockup on sm+ */
  variant: { type: String, default: 'auto' }, // auto | mark | lockup

  /**
   * Optional convenience size (Tailwind scale number) applied to both mobile + desktop.
   * Example: size=9 -> 36px height.
   */
  size: { type: [String, Number], default: null },

  /**
   * Fine-grained heights (Tailwind scale number) for mobile + desktop.
   * If provided, they override `size`.
   */
  mobile: { type: [String, Number], default: null },
  desktop: { type: [String, Number], default: null },

  alt: { type: String, default: 'JabuSpark' }
})

function toCssHeight(v) {
  if (v === null || v === undefined || v === '') return '36px'
  // If numeric (or numeric string), treat as Tailwind scale (n * 4px)
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  if (!Number.isNaN(n) && Number.isFinite(n)) return `${Math.max(0, n) * 4}px`

  const s = String(v).trim()
  // Allow explicit units: px/rem/em/%/vh/vw
  if (/(px|rem|em|%|vh|vw)$/.test(s)) return s
  return s
}

const mobileH = computed(() => toCssHeight(props.mobile ?? props.size ?? 9))
const desktopH = computed(() => toCssHeight(props.desktop ?? props.size ?? 10))

const imgBase = 'w-auto object-contain select-none'
</script>

<template>
  <!-- AUTO: mark on mobile, lockup on sm+ -->
  <div v-if="variant === 'auto'" class="flex items-center">
    <img
      :src="mark"
      :alt="alt"
      :style="{ height: mobileH }"
      class="sm:hidden"
      :class="imgBase"
      draggable="false"
    />
    <img
      :src="lockup"
      :alt="alt"
      :style="{ height: desktopH }"
      class="hidden sm:block"
      :class="imgBase"
      draggable="false"
    />
  </div>

  <!-- MARK only -->
  <img
    v-else-if="variant === 'mark'"
    :src="mark"
    :alt="alt"
    :style="{ height: mobileH }"
    :class="imgBase"
    draggable="false"
  />

  <!-- LOCKUP only -->
  <img
    v-else
    :src="lockup"
    :alt="alt"
    :style="{ height: desktopH }"
    :class="imgBase"
    draggable="false"
  />
</template>
