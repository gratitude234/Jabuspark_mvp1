<script setup>
import { computed, onMounted, ref } from 'vue'
import { useDataStore } from '../stores/data'
import { toast } from '../utils/toast'
import AppCard from '../components/AppCard.vue'

const data = useDataStore()

const tab = ref('feed') // 'feed' | 'channels'
const channelFilter = ref('all') // 'all' | channelId
const openId = ref('')

const q = ref('')
const unreadOnly = ref(false)

const isLoading = ref(false)
const isRefreshing = ref(false)

const channels = computed(() => data.notify.channels || [])
const unreadTotal = computed(() => Number(data.progress?.notifyUnread || 0))

const followedChannels = computed(() => channels.value.filter((c) => c.isFollowed))
const followedCount = computed(() => followedChannels.value.length)

const filteredFeed = computed(() => {
  const all = data.notify.feed || []
  const byChannel =
    channelFilter.value === 'all' ? all : all.filter((p) => p.channelId === channelFilter.value)
  const byUnread = unreadOnly.value ? byChannel.filter((p) => !p.isRead) : byChannel
  // keep API order (already pinned-first on backend ideally), but we also group in UI below
  return byUnread
})

const pinnedPosts = computed(() => filteredFeed.value.filter((p) => p.isPinned))
const normalPosts = computed(() => filteredFeed.value.filter((p) => !p.isPinned))

const generalChannels = computed(() => {
  const list = channels.value.filter((c) => c.scopeType !== 'course')
  return sortChannels(list, q.value)
})

const courseChannels = computed(() => {
  const list = channels.value.filter((c) => c.scopeType === 'course')
  return sortChannels(list, q.value)
})

function sortChannels(list, query) {
  const needle = (query || '').trim().toLowerCase()
  const filtered = !needle
    ? list
    : list.filter((c) => String(c.name || '').toLowerCase().includes(needle))

  // followed first, then unread desc, then name asc
  return [...filtered].sort((a, b) => {
    const af = a.isFollowed ? 1 : 0
    const bf = b.isFollowed ? 1 : 0
    if (af !== bf) return bf - af
    const au = Number(a.unreadCount || 0)
    const bu = Number(b.unreadCount || 0)
    if (au !== bu) return bu - au
    return String(a.name || '').localeCompare(String(b.name || ''))
  })
}

function fmtTime(s) {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return String(s)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function refresh({ silent = false } = {}) {
  if (!silent) isRefreshing.value = true
  try {
    await Promise.allSettled([
      data.fetchNotifyChannels(),
      data.fetchNotifyFeed({
        limit: 40,
        channelId: channelFilter.value === 'all' ? '' : channelFilter.value
      })
    ])
  } finally {
    isRefreshing.value = false
  }
}

let syncTimer = null
function syncUnreadSoon() {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    data.fetchNotifyChannels().catch(() => {})
  }, 600)
}

async function toggleFollow(ch) {
  const wasFollowed = !!ch.isFollowed
  try {
    // If user is filtering by this channel and they unfollow it, bounce back to "all"
    if (wasFollowed && channelFilter.value === ch.id) {
      channelFilter.value = 'all'
    }

    await data.toggleNotifyFollow(ch.id)
    toast(wasFollowed ? 'Unfollowed.' : 'Followed.', 'ok')
    await refresh({ silent: true })
  } catch (e) {
    toast(e?.message || 'Failed', 'warn')
  }
}

async function openPost(p) {
  const next = openId.value === p.id ? '' : p.id
  openId.value = next

  if (next && !p.isRead) {
    try {
      await data.markNotifyRead(p.id)
      // keep channel unread counts accurate without refetching the whole feed
      syncUnreadSoon()
    } catch (e) {
      // don't block UI expand
    }
  }
}

async function markAllRead() {
  try {
    const channelId = channelFilter.value === 'all' ? '' : channelFilter.value
    openId.value = ''
    await data.markAllNotifyRead({ channelId })
    toast('Marked as read.', 'ok')
    // store already refreshes channels+feed, but keep UX crisp
    await refresh({ silent: true })
  } catch (e) {
    toast(e?.message || 'Failed', 'warn')
  }
}

async function changeFilter() {
  openId.value = ''
  await refresh()
}

onMounted(async () => {
  isLoading.value = true
  try {
    await refresh()
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="page">
    <AppCard class="card-pad">
      <!-- Header -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="kicker">JabuNotify</div>
          <div class="h1 mt-1">Announcements</div>
          <p class="sub mt-2 max-w-[70ch]">
            Course uploads, updates, and campus info — delivered through channels you follow.
          </p>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="chip">
              <span class="font-semibold">Unread</span>
              <span class="badge">{{ unreadTotal }}</span>
            </span>
            <span class="chip">
              <span class="font-semibold">Following</span>
              <span class="badge">{{ followedCount }}</span>
            </span>
            <button
              class="chip"
              type="button"
              @click="tab = 'channels'"
              v-if="tab === 'feed' && followedCount === 0"
            >
              Follow channels →
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button class="btn btn-ghost btn-sm" @click="refresh" :disabled="isRefreshing">
            {{ isRefreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
          <button
            class="btn btn-ghost btn-sm"
            @click="markAllRead"
            :disabled="unreadTotal === 0 || isRefreshing"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div class="divider my-5" />

      <!-- Tabs + Controls -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="seg">
          <button
            class="seg-btn"
            :class="tab === 'feed' ? 'seg-btn--active' : 'seg-btn--inactive'"
            @click="tab = 'feed'"
            type="button"
          >
            Feed
          </button>
          <button
            class="seg-btn"
            :class="tab === 'channels' ? 'seg-btn--active' : 'seg-btn--inactive'"
            @click="tab = 'channels'"
            type="button"
          >
            Channels
          </button>
        </div>

        <!-- Feed controls -->
        <div v-if="tab === 'feed'" class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div class="flex items-center gap-2">
            <span class="kicker">Filter</span>
            <select v-model="channelFilter" class="select w-full sm:w-auto" @change="changeFilter">
              <option value="all">All followed</option>
              <option v-for="c in followedChannels" :key="c.id" :value="c.id">
                {{ c.name }}
                <template v-if="c.unreadCount"> ({{ c.unreadCount }})</template>
              </option>
            </select>
          </div>

          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :class="unreadOnly ? 'ring-1 ring-accent/40' : ''"
            @click="unreadOnly = !unreadOnly"
          >
            {{ unreadOnly ? 'Showing: Unread' : 'Show unread only' }}
          </button>
        </div>

        <!-- Channels controls -->
        <div v-else class="w-full sm:w-[360px]">
          <input
            v-model="q"
            class="input"
            type="text"
            placeholder="Search channels…"
            autocomplete="off"
          />
        </div>
      </div>

      <!-- FEED -->
      <div v-if="tab === 'feed'" class="mt-5">
        <div v-if="isLoading" class="grid gap-2">
          <div class="card card-pad">
            <div class="skeleton h-4 w-28" />
            <div class="skeleton mt-3 h-5 w-3/4" />
            <div class="skeleton mt-2 h-4 w-40" />
          </div>
          <div class="card card-pad">
            <div class="skeleton h-4 w-24" />
            <div class="skeleton mt-3 h-5 w-2/3" />
            <div class="skeleton mt-2 h-4 w-44" />
          </div>
        </div>

        <div v-else-if="followedCount === 0" class="alert alert-warn">
          You’re not following any channels yet. Open <b>Channels</b> and follow the ones you want —
          your feed will start populating immediately.
        </div>

        <div v-else-if="filteredFeed.length === 0" class="alert alert-ok">
          <span v-if="unreadOnly">No unread announcements right now.</span>
          <span v-else>No announcements yet for your followed channels.</span>
        </div>

        <div v-else class="grid gap-2">
          <!-- Pinned -->
          <div v-if="pinnedPosts.length" class="mt-1">
            <div class="kicker mb-2">Pinned</div>
            <div class="grid gap-2">
              <div
                v-for="p in pinnedPosts"
                :key="p.id"
                class="card card-pad card-press"
                :class="{ 'ring-1 ring-accent/30': !p.isRead }"
              >
                <button type="button" class="w-full text-left" @click="openPost(p)">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="badge">Pinned</span>
                        <span class="badge">{{ p.channelName }}</span>
                        <span v-if="!p.isRead" class="badge" style="border-color: rgba(124,58,237,.35)">
                          New
                        </span>
                      </div>

                      <div class="h3 mt-2 clamp-2">{{ p.title }}</div>
                      <div class="text-xs text-text-3 mt-1">{{ fmtTime(p.createdAt) }}</div>
                    </div>

                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="h-5 w-5 text-text-3 shrink-0 transition duration-200"
                      :class="openId === p.id ? 'rotate-90' : ''"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </button>

                <div v-if="openId === p.id" class="mt-3">
                  <div class="sub whitespace-pre-wrap">{{ p.body }}</div>

                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      v-if="p.linkUrl"
                      :href="p.linkUrl"
                      target="_blank"
                      rel="noreferrer"
                      class="btn btn-primary btn-sm"
                    >
                      Open
                    </a>
                    <button type="button" class="btn btn-ghost btn-sm" @click="openId = ''">
                      Collapse
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="divider my-5" />
          </div>

          <!-- Latest -->
          <div>
            <div class="kicker mb-2">Latest</div>
            <div class="grid gap-2">
              <div
                v-for="p in normalPosts"
                :key="p.id"
                class="card card-pad card-press"
                :class="{ 'ring-1 ring-accent/30': !p.isRead }"
              >
                <button type="button" class="w-full text-left" @click="openPost(p)">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="badge">{{ p.channelName }}</span>
                        <span v-if="!p.isRead" class="badge" style="border-color: rgba(124,58,237,.35)">
                          New
                        </span>
                      </div>

                      <div class="h3 mt-2 clamp-2">{{ p.title }}</div>
                      <div class="text-xs text-text-3 mt-1">{{ fmtTime(p.createdAt) }}</div>
                    </div>

                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="h-5 w-5 text-text-3 shrink-0 transition duration-200"
                      :class="openId === p.id ? 'rotate-90' : ''"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </button>

                <div v-if="openId === p.id" class="mt-3">
                  <div class="sub whitespace-pre-wrap">{{ p.body }}</div>

                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      v-if="p.linkUrl"
                      :href="p.linkUrl"
                      target="_blank"
                      rel="noreferrer"
                      class="btn btn-primary btn-sm"
                    >
                      Open
                    </a>
                    <button type="button" class="btn btn-ghost btn-sm" @click="openId = ''">
                      Collapse
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer hint -->
          <div class="mt-4 text-xs text-text-3">
            Tip: Follow more channels in <b>Channels</b> to receive more updates.
          </div>
        </div>
      </div>

      <!-- CHANNELS -->
      <div v-else class="mt-5">
        <div class="h2">Follow channels</div>
        <p class="sub mt-2">
          Your feed shows only channels you follow. Follow your course channels to see uploads instantly.
        </p>

        <div class="divider my-5" />

        <div v-if="channels.length === 0" class="alert alert-warn">No channels found.</div>

        <div v-else class="grid gap-4">
          <!-- General -->
          <div>
            <div class="row">
              <div>
                <div class="h3">General</div>
                <div class="text-xs text-text-3 mt-1">Campus-wide announcements.</div>
              </div>
            </div>

            <div v-if="generalChannels.length === 0" class="mt-3 text-sm text-text-3">
              No general channels match your search.
            </div>

            <div v-else class="mt-3 grid gap-2">
              <div v-for="c in generalChannels" :key="c.id" class="panel p-4">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="h3 truncate">{{ c.name }}</div>
                    <div class="text-xs text-text-3 mt-1 flex flex-wrap items-center gap-2">
                      <span class="badge">General</span>
                      <span v-if="c.unreadCount" class="badge">{{ c.unreadCount }} unread</span>
                      <span v-if="c.isFollowed" class="badge">Following</span>
                    </div>
                  </div>

                  <button
                    class="btn btn-sm"
                    :class="c.isFollowed ? 'btn-ghost' : 'btn-primary'"
                    @click="toggleFollow(c)"
                    type="button"
                  >
                    {{ c.isFollowed ? 'Following' : 'Follow' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Courses -->
          <div>
            <div class="row">
              <div>
                <div class="h3">Courses</div>
                <div class="text-xs text-text-3 mt-1">
                  Updates tied to your selected courses (uploads, past questions, practice banks).
                </div>
              </div>
              <button class="btn btn-ghost btn-sm" type="button" @click="q = ''" v-if="q">
                Clear search
              </button>
            </div>

            <div v-if="courseChannels.length === 0" class="mt-3 text-sm text-text-3">
              No course channels match your search.
            </div>

            <div v-else class="mt-3 grid gap-2">
              <div v-for="c in courseChannels" :key="c.id" class="panel p-4">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="h3 truncate">{{ c.name }}</div>
                    <div class="text-xs text-text-3 mt-1 flex flex-wrap items-center gap-2">
                      <span class="badge">Course</span>
                      <span v-if="c.unreadCount" class="badge">{{ c.unreadCount }} unread</span>
                      <span v-if="c.isFollowed" class="badge">Following</span>
                    </div>
                  </div>

                  <button
                    class="btn btn-sm"
                    :class="c.isFollowed ? 'btn-ghost' : 'btn-primary'"
                    @click="toggleFollow(c)"
                    type="button"
                  >
                    {{ c.isFollowed ? 'Following' : 'Follow' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Helper -->
          <div class="alert alert-ok">
            If you’re not seeing course updates, check your course selection in your profile/onboarding, then follow the
            relevant course channels here.
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
