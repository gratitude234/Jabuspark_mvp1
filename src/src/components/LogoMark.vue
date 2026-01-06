<script setup>
import { computed } from 'vue'

// NOTE: "logo-lockup.png" likely contains the old brand text (JabuSpark).
// After renaming the product to JabuStudyHub, we render a text lockup
// (mark + brand name) by default. The legacy lockup image remains available
// via variant="lockup-image" if you still need it.
import lockup from '../assets/logo-lockup.png'
import mark from '../assets/logo-mark.png'

const props = defineProps({
  /**
   * auto: mark on mobile + text lockup on sm+
   * mark: mark only
   * lockup: mark + brand text
   * lockup-image: legacy image lockup
   */
  variant: { type: String, default: 'auto' }, // auto | mark | lockup | lockup-image

  /** Display brand name (used for text lockups). */
  brand: { type: String, default: 'JabuStudyHub' },

  /** Optional convenience size (Tailwind scale number) applied to both mobile + desktop. */
  size: { type: [String, Number], default: null },

  /** Fine-grained heights (Tailwind scale number) for mobile + desktop (overrides `size`). */
  mobile: { type: [String, Number], default: null },
  desktop: { type: [String, Number], default: null },

  /** Optional alt text override (falls back to brand). */
  alt: { type: String, default: '' },

  /** Optional extra classes for the brand text. */
  textClass: { type: String, default: '' },
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

const altText = computed(() => (props.alt || props.brand || '').trim() || 'JabuStudyHub')

const imgBase = 'w-auto object-contain select-none'

const labelClass = computed(() =>
  [
    'leading-none',
    'font-extrabold',
    'tracking-tight',
    'text-text',
    'select-none',
    // sensible defaults
    'text-lg',
    props.textClass,
  ]
    .filter(Boolean)
    .join(' ')
)
</script>

<template>
  <!-- AUTO: mark on mobile, mark+text lockup on sm+ -->
  <div v-if="variant === 'auto'" class="flex items-center">
    <img
      :src="mark"
      :alt="altText"
      :style="{ height: mobileH }"
      class="sm:hidden"
      :class="imgBase"
      draggable="false"
    />

    <div class="hidden sm:flex items-center gap-2">
      <img
        :src="mark"
        :alt="altText"
        :style="{ height: desktopH }"
        :class="imgBase"
        draggable="false"
      />
      <span :class="labelClass">{{ brand }}</span>
    </div>
  </div>

  <!-- MARK only -->
  <img
    v-else-if="variant === 'mark'"
    :src="mark"
    :alt="altText"
    :style="{ height: mobileH }"
    :class="imgBase"
    draggable="false"
  />

  <!-- TEXT LOCKUP: mark + brand -->
  <div v-else-if="variant === 'lockup'" class="flex items-center gap-2">
    <img
      :src="mark"
      :alt="altText"
      :style="{ height: desktopH }"
      :class="imgBase"
      draggable="false"
    />
    <span :class="labelClass">{{ brand }}</span>
  </div>

  <!-- LEGACY IMAGE LOCKUP (contains old name) -->
  <img
    v-else
    :src="lockup"
    :alt="altText"
    :style="{ height: desktopH }"
    :class="imgBase"
    draggable="false"
  />
</template>
