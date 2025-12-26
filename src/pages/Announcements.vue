<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useNotifyStore } from '../stores/notify'
import { useAuthStore } from '../stores/auth'
import AppSelect from '../components/AppSelect.vue'
import AppInput from '../components/AppInput.vue'
import AppCard from '../components/AppCard.vue'
import AppButton from '../components/AppButton.vue'

const notify = useNotifyStore()
const auth = useAuthStore()

const channelId = ref('')
const showUnreadOnly = ref(false)
const query = ref('')
const busy = ref(false)
const error = ref('')
const posts = ref([])

const channelOptions = computed(() => {
  const chans = (notify.channels || [])
    .filter((c) => notify.followedChannelIds.includes(c.id))
    .map((c) => ({ value: c.id, label: c.name }))

  return [{ value: '', label: 'All followed channels' }, ...chans]
})

const filteredPosts = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return posts.value
  return posts.value.filter((p) => {
    const hay = `${p.title || ''} ${p.body || ''} ${p.channelName || ''}`.toLowerCase()
    return hay.includes(q)
  })
})

async function load() {
  busy.value = true
  error.value = ''
  try {
    posts.value = await notify.fetchPosts({
      channelId: channelId.value,
      unread: showUnreadOnly.value,
      limit: 50,
      offset: 0,
    })
  } catch (e) {
    error.value = e?.message || 'Failed to load announcements'
  } finally {
    busy.value = false
  }
}

function fmtDate(s) {
  if (!s) return ''
  try {
    const d = new Date(s)
    return d.toLocaleString()
  } catch {
    return s
  }
}

function shareText(p) {
  const lines = []
  lines.push(`*${p.title}*`)
  if (p.channelName) lines.push(`(${p.channelName})`)
  lines.push('')
  lines.push((p.body || '').trim())
  if (p.linkUrl) {
    lines.push('')
    lines.push(p.linkUrl)
  }
  return lines.join('\n')
}

function shareWhatsApp(p) {
  const text = encodeURIComponent(shareText(p))
  window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
}

async function openPost(p) {
  // mark read on open
  if (!p.isRead) {
    try {
      await notify.markRead({ postIds: [p.id] })
      p.isRead = true
    } catch {
      // ignore
    }
  }
  p.__open = !p.__open
}

async function markAllRead() {
  busy.value = true
  try {
    await notify.markRead({ markAll: true })
    await load()
  } finally {
    busy.value = false
  }
}

async function toggleFollow(chId, shouldFollow) {
  await notify.toggleFollow(chId, shouldFollow)
  // If the active filter is now invalid, reset
  if (channelId.value && !notify.followedChannelIds.includes(channelId.value)) channelId.value = ''
  await load()
}

const followedChannels = computed(() =>
  (notify.channels || []).filter((c) => notify.followedChannelIds.includes(c.id))
)
const otherChannels = computed(() =>
  (notify.channels || []).filter((c) => !notify.followedChannelIds.includes(c.id))
)

onMounted(async () => {
  if (auth?.isAuthed) {
    await notify.bootstrap()
    await load()
  }
})

watch([channelId, showUnreadOnly], () => load())
</script>

<template>
  <div class="page">
    <div class="row">
      <div>
        <div class="h1">Announcements</div>
        <div class="sub">Verified updates you can trust — easy to share to your class WhatsApp groups.</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-ghost btn-sm" :disabled="busy" @click="markAllRead">
          Mark all read
        </button>
      </div>
    </div>

    <AppCard>
      <div class="card-pad space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div class="label">Channel</div>
            <AppSelect v-model="channelId" :options="channelOptions" />
          </div>
          <div>
            <div class="label">Search</div>
            <AppInput v-model="query" placeholder="Search title or keywords…" />
          </div>
          <div class="flex items-end">
            <label class="chip inline-flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" v-model="showUnreadOnly" class="accent-accent" />
              <span class="text-sm">Unread only</span>
            </label>
          </div>
        </div>

        <div class="divider" />

        <div class="grid gap-2 sm:grid-cols-2">
          <div class="card card-pad">
            <div class="kicker">Following</div>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="c in followedChannels"
                :key="c.id"
                class="chip hover:bg-white/[0.06]"
                @click="toggleFollow(c.id, false)"
                :title="c.slug === 'general' ? 'General cannot be unfollowed' : 'Unfollow'"
                :disabled="c.slug === 'general'"
              >
                {{ c.name }}
                <span class="text-text-3">•</span>
                <span class="text-xs">Unfollow</span>
              </button>
              <div v-if="followedChannels.length === 0" class="sub">No followed channels yet.</div>
            </div>
          </div>

          <div class="card card-pad">
            <div class="kicker">Discover</div>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="c in otherChannels"
                :key="c.id"
                class="chip hover:bg-white/[0.06]"
                @click="toggleFollow(c.id, true)"
              >
                {{ c.name }}
                <span class="text-text-3">•</span>
                <span class="text-xs">Follow</span>
              </button>
              <div v-if="otherChannels.length === 0" class="sub">No more channels available.</div>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <div v-if="error" class="card card-pad">
      <div class="text-danger font-semibold">{{ error }}</div>
    </div>

    <div v-if="busy" class="card card-pad">
      <div class="sub">Loading announcements…</div>
    </div>

    <div v-else class="space-y-3">
      <div v-if="filteredPosts.length === 0" class="card card-pad">
        <div class="sub">No announcements yet. Check back soon.</div>
      </div>

      <button
        v-for="p in filteredPosts"
        :key="p.id"
        class="card card-pad text-left card-press"
        @click="openPost(p)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span v-if="p.isPinned" class="pill bg-white/[0.08]">Pinned</span>
              <span v-if="!p.isRead" class="pill bg-accent/20 text-accent">Unread</span>
              <span class="text-xs text-text-3">{{ p.channelName }}</span>
            </div>
            <div class="mt-1 font-bold text-base truncate">{{ p.title }}</div>
            <div class="mt-1 text-xs text-text-3">{{ fmtDate(p.createdAt) }} • {{ p.createdBy?.fullName || 'Admin' }}</div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button class="btn btn-ghost btn-sm" type="button" @click.stop="shareWhatsApp(p)">Share</button>
          </div>
        </div>

        <div class="mt-3 sub" :class="p.__open ? '' : 'line-clamp-2'">
          {{ p.body }}
        </div>

        <div v-if="p.__open" class="mt-3 space-y-2">
          <div v-if="p.linkUrl" class="text-sm">
            <a class="text-accent hover:underline" :href="p.linkUrl" target="_blank" rel="noreferrer">
              Open link
            </a>
          </div>

          <div v-if="p.attachmentUrl" class="text-sm">
            <a class="text-accent hover:underline" :href="p.attachmentUrl" target="_blank" rel="noreferrer">
              View attachment
            </a>
          </div>

          <div class="text-xs text-text-3">Click again to collapse</div>
        </div>
      </button>
    </div>
  </div>
</template>
