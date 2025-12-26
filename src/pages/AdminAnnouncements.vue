<script setup>
import { computed, onMounted, ref } from 'vue'
import { useNotifyStore } from '../stores/notify'
import { useAuthStore } from '../stores/auth'
import AppCard from '../components/AppCard.vue'
import AppInput from '../components/AppInput.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const auth = useAuthStore()
const notify = useNotifyStore()

const tab = ref('posts') // posts | channels

// Channel create
const chanName = ref('')
const chanSlug = ref('')
const chanScopeType = ref('general')
const chanScopeId = ref('')
const chanBusy = ref(false)
const chanError = ref('')

// Post create
const postChannelId = ref('')
const postTitle = ref('')
const postBody = ref('')
const postLinkUrl = ref('')
const postPinned = ref(false)
const postExpiresAt = ref('')
const postBusy = ref(false)
const postError = ref('')
const posts = ref([])

const channelOptions = computed(() =>
  (notify.channels || []).map((c) => ({ value: c.id, label: `${c.name} (${c.slug})` }))
)

async function loadPosts() {
  posts.value = await notify.fetchPosts({ limit: 50, offset: 0 })
}

async function createChannel() {
  chanBusy.value = true
  chanError.value = ''
  try {
    await notify.adminCreateChannel({
      name: chanName.value,
      slug: chanSlug.value,
      scopeType: chanScopeType.value,
      scopeId: chanScopeId.value.trim() ? chanScopeId.value.trim() : null,
    })
    chanName.value = ''
    chanSlug.value = ''
    chanScopeId.value = ''
  } catch (e) {
    chanError.value = e?.message || 'Failed to create channel'
  } finally {
    chanBusy.value = false
  }
}

async function createPost() {
  postBusy.value = true
  postError.value = ''
  try {
    await notify.adminCreatePost({
      channelId: postChannelId.value,
      title: postTitle.value,
      body: postBody.value,
      linkUrl: postLinkUrl.value.trim() || null,
      isPinned: !!postPinned.value,
      expiresAt: postExpiresAt.value.trim() || null,
    })
    postTitle.value = ''
    postBody.value = ''
    postLinkUrl.value = ''
    postPinned.value = false
    postExpiresAt.value = ''
    await notify.refreshSummary()
    await loadPosts()
  } catch (e) {
    postError.value = e?.message || 'Failed to create post'
  } finally {
    postBusy.value = false
  }
}

async function deletePost(id) {
  if (!confirm('Delete this announcement?')) return
  try {
    await notify.adminDeletePost(id)
    await loadPosts()
    await notify.refreshSummary()
  } catch (e) {
    alert(e?.message || 'Failed to delete')
  }
}

onMounted(async () => {
  if (!auth.isAuthed) return
  await notify.bootstrap()
  postChannelId.value = notify.channels?.[0]?.id || ''
  await loadPosts()
})
</script>

<template>
  <div class="page">
    <div class="row">
      <div>
        <div class="h1">Admin • Announcements</div>
        <div class="sub">Post verified updates and manage channels.</div>
      </div>
      <div class="seg">
        <button class="seg-btn" :class="tab === 'posts' ? 'seg-btn--active' : ''" @click="tab = 'posts'">
          Posts
        </button>
        <button class="seg-btn" :class="tab === 'channels' ? 'seg-btn--active' : ''" @click="tab = 'channels'">
          Channels
        </button>
      </div>
    </div>

    <div v-if="tab === 'posts'" class="grid gap-4 lg:grid-cols-5">
      <AppCard class="lg:col-span-2">
        <div class="card-pad space-y-3">
          <div class="h2">Create announcement</div>

          <div>
            <div class="label">Channel</div>
            <AppSelect v-model="postChannelId" :options="channelOptions" />
          </div>

          <div>
            <div class="label">Title</div>
            <AppInput v-model="postTitle" placeholder="e.g., GST 211 test postponed" />
          </div>

          <div>
            <div class="label">Body</div>
            <textarea v-model="postBody" class="input" rows="6" placeholder="Write the update clearly…" />
          </div>

          <div>
            <div class="label">Link (optional)</div>
            <AppInput v-model="postLinkUrl" placeholder="https://…" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="chip inline-flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" v-model="postPinned" class="accent-accent" />
              <span class="text-sm">Pin this</span>
            </label>

            <div>
              <div class="label">Expires (optional)</div>
              <AppInput v-model="postExpiresAt" placeholder="2025-12-31T23:59:59Z" />
              <div class="help">ISO format preferred (UTC).</div>
            </div>
          </div>

          <div v-if="postError" class="text-danger text-sm">{{ postError }}</div>
          <AppButton :busy="postBusy" class="w-full" @click="createPost">Publish</AppButton>
        </div>
      </AppCard>

      <div class="lg:col-span-3 space-y-3">
        <div class="card card-pad">
          <div class="row">
            <div>
              <div class="h2">Recent posts</div>
              <div class="sub">Click delete to remove incorrect info.</div>
            </div>
            <button class="btn btn-ghost btn-sm" @click="loadPosts">Refresh</button>
          </div>
        </div>

        <div v-if="posts.length === 0" class="card card-pad">
          <div class="sub">No announcements yet.</div>
        </div>

        <div v-for="p in posts" :key="p.id" class="card card-pad">
          <div class="row">
            <div class="min-w-0">
              <div class="text-xs text-text-3">{{ p.channelName }}</div>
              <div class="font-bold truncate">{{ p.title }}</div>
              <div class="text-xs text-text-3">{{ p.createdAt }}</div>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="p.isPinned" class="pill bg-white/[0.08]">Pinned</span>
              <button class="btn btn-danger btn-sm" @click="deletePost(p.id)">Delete</button>
            </div>
          </div>
          <div class="mt-2 sub line-clamp-3">{{ p.body }}</div>
        </div>
      </div>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-5">
      <AppCard class="lg:col-span-2">
        <div class="card-pad space-y-3">
          <div class="h2">Create channel</div>

          <div>
            <div class="label">Name</div>
            <AppInput v-model="chanName" placeholder="e.g., Engineering Faculty" />
          </div>
          <div>
            <div class="label">Slug</div>
            <AppInput v-model="chanSlug" placeholder="engineering" />
            <div class="help">Lowercase, no spaces (we'll auto-normalize).</div>
          </div>
          <div>
            <div class="label">Scope</div>
            <AppSelect
              v-model="chanScopeType"
              :options="[
                { value: 'general', label: 'General' },
                { value: 'faculty', label: 'Faculty' },
                { value: 'department', label: 'Department' },
                { value: 'level', label: 'Level' },
                { value: 'course', label: 'Course' },
              ]"
            />
            <div class="help">Scopes help with future rep posting rules (optional now).</div>
          </div>
          <div>
            <div class="label">Scope ID (optional)</div>
            <AppInput v-model="chanScopeId" placeholder="department_id / course_id / level" />
          </div>

          <div v-if="chanError" class="text-danger text-sm">{{ chanError }}</div>
          <AppButton :busy="chanBusy" class="w-full" @click="createChannel">Create</AppButton>
        </div>
      </AppCard>

      <div class="lg:col-span-3">
        <div class="card card-pad">
          <div class="row">
            <div>
              <div class="h2">Channels</div>
              <div class="sub">These are what students can follow.</div>
            </div>
            <button class="btn btn-ghost btn-sm" @click="notify.refreshSummary">Refresh</button>
          </div>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div v-for="c in notify.channels" :key="c.id" class="card card-pad">
            <div class="font-bold">{{ c.name }}</div>
            <div class="text-xs text-text-3">{{ c.slug }} • {{ c.scope_type }}{{ c.scope_id ? `:${c.scope_id}` : '' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
