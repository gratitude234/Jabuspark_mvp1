<script setup>
import { computed, onMounted, ref } from 'vue'
import { useDataStore } from '../stores/data'
import { toast } from '../utils/toast'
import AppCard from '../components/AppCard.vue'

const data = useDataStore()

const tab = ref('feed')
const channelFilter = ref('all')
const openId = ref('')

const channels = computed(() => data.notify.channels || [])

const followedCount = computed(() => channels.value.filter((c) => c.isFollowed).length)

const feed = computed(() => {
  const all = data.notify.feed || []
  if (channelFilter.value === 'all') return all
  return all.filter((p) => p.channelId === channelFilter.value)
})

function fmtTime(s) {
  if (!s) return ''
  // MySQL timestamp -> Date
  const d = new Date(String(s).replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return String(s)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function refresh() {
  await Promise.allSettled([
    data.fetchNotifyChannels(),
    data.fetchNotifyFeed({ limit: 40, channelId: channelFilter.value === 'all' ? '' : channelFilter.value })
  ])
}

async function toggleFollow(ch) {
  try {
    await data.toggleNotifyFollow(ch.id)
    toast(ch.isFollowed ? 'Unfollowed.' : 'Followed.', 'ok')
    await refresh()
  } catch (e) {
    toast(e?.message || 'Failed', 'warn')
  }
}

async function openPost(p) {
  openId.value = openId.value === p.id ? '' : p.id
  if (!p.isRead) {
    await data.markNotifyRead(p.id)
  }
}

async function markAllRead() {
  const channelId = channelFilter.value === 'all' ? '' : channelFilter.value
  await data.markAllNotifyRead({ channelId })
  toast('Marked as read.', 'ok')
}

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="row">
        <div>
          <div class="h1">Announcements</div>
          <p class="sub mt-1">Course updates, uploads, and campus info — all in one place.</p>
        </div>

        <div class="flex items-center gap-2">
          <button class="btn btn-ghost btn-sm" @click="refresh">Refresh</button>
          <button class="btn btn-ghost btn-sm" @click="markAllRead" :disabled="(data.progress.notifyUnread || 0) === 0">
            Mark all read
          </button>
        </div>
      </div>

      <div class="divider my-4" />

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="seg">
          <button class="seg-btn" :class="{ active: tab === 'feed' }" @click="tab = 'feed'">Feed</button>
          <button class="seg-btn" :class="{ active: tab === 'channels' }" @click="tab = 'channels'">Channels</button>
        </div>

        <div v-if="tab === 'feed'" class="flex items-center gap-2">
          <label class="text-xs text-text-3">Filter</label>
          <select v-model="channelFilter" class="input input-sm" @change="refresh">
            <option value="all">All followed</option>
            <option v-for="c in channels.filter((c) => c.isFollowed)" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="tab === 'feed'" class="mt-4">
        <div v-if="followedCount === 0" class="alert alert-warn">
          You’re not following any channels yet. Go to <b>Channels</b> and follow the ones you want.
        </div>

        <div v-else-if="feed.length === 0" class="alert alert-ok">
          No announcements yet for your followed channels.
        </div>

        <div v-else class="grid gap-2">
          <div
            v-for="p in feed"
            :key="p.id"
            class="card card-pad"
            :class="{ 'ring-1 ring-accent/30': !p.isRead }"
          >
            <button type="button" class="w-full text-left" @click="openPost(p)">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span v-if="p.isPinned" class="badge">Pinned</span>
                    <span class="badge">{{ p.channelName }}</span>
                    <span v-if="!p.isRead" class="badge badge-accent">New</span>
                  </div>
                  <div class="text-sm font-extrabold mt-2">{{ p.title }}</div>
                  <div class="text-xs text-text-3 mt-1">{{ fmtTime(p.createdAt) }}</div>
                </div>

                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-text-3 shrink-0">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </button>

            <div v-if="openId === p.id" class="mt-3">
              <div class="sub whitespace-pre-wrap">{{ p.body }}</div>

              <div v-if="p.linkUrl" class="mt-3">
                <a :href="p.linkUrl" target="_blank" rel="noreferrer" class="btn btn-primary btn-sm">Open</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="mt-4">
        <div class="text-sm font-extrabold">Follow channels</div>
        <p class="sub mt-1">Turn on what matters to you. Your feed shows only followed channels.</p>

        <div class="divider my-4" />

        <div v-if="channels.length === 0" class="alert alert-warn">No channels found.</div>

        <div v-else class="grid gap-2">
          <div v-for="c in channels" :key="c.id" class="card card-pad">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">{{ c.name }}</div>
                <div class="text-xs text-text-3 mt-1">
                  <span v-if="c.scopeType === 'course'">Course channel</span>
                  <span v-else>General channel</span>
                  <span v-if="c.unreadCount" class="ml-2">• {{ c.unreadCount }} unread</span>
                </div>
              </div>

              <button class="btn btn-sm" :class="c.isFollowed ? 'btn-ghost' : 'btn-primary'" @click="toggleFollow(c)">
                {{ c.isFollowed ? 'Following' : 'Follow' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  gap: 0;
  padding: 0.25rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}
.seg-btn {
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.75);
}
.seg-btn.active {
  background: rgba(255, 255, 255, 0.12);
  color: white;
}
</style>
