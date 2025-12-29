<script setup>
import { computed, onMounted, ref } from 'vue'
import { useDataStore } from '../stores/data'
import { toast } from '../utils/toast'
import AppCard from '../components/AppCard.vue'

const data = useDataStore()

const loading = ref(false)

const channelId = ref('')
const title = ref('')
const body = ref('')
const linkUrl = ref('')
const isPinned = ref(false)

const channels = computed(() => (data.notify.channels || []).filter((c) => !!c.id))

onMounted(async () => {
  await data.fetchNotifyChannels()
  if (!channelId.value && channels.value.length) channelId.value = channels.value[0].id
})

async function postNow() {
  if (!channelId.value || !title.value.trim() || !body.value.trim()) {
    toast('Please fill channel, title, and body.', 'warn')
    return
  }

  loading.value = true
  try {
    await data.adminCreateNotifyPost({
      channelId: channelId.value,
      title: title.value.trim(),
      body: body.value.trim(),
      linkUrl: linkUrl.value.trim(),
      isPinned: isPinned.value,
    })
    toast('Announcement posted.', 'ok')
    title.value = ''
    body.value = ''
    linkUrl.value = ''
    isPinned.value = false
  } catch (e) {
    toast(e?.message || 'Failed to post', 'warn')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="row">
        <div>
          <div class="h1">Post announcement</div>
          <p class="sub mt-1">Admins can send announcements to all students or specific course channels.</p>
        </div>
        <RouterLink to="/notify" class="btn btn-ghost">View feed</RouterLink>
      </div>

      <div class="divider my-4" />

      <div class="grid gap-3">
        <label class="grid gap-1">
          <span class="label">Channel</span>
          <select v-model="channelId" class="input">
            <option v-for="c in channels" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>

        <label class="grid gap-1">
          <span class="label">Title</span>
          <input v-model="title" class="input" placeholder="e.g., New timetable is out" />
        </label>

        <label class="grid gap-1">
          <span class="label">Body</span>
          <textarea v-model="body" class="input min-h-[140px]" placeholder="Write a short, clear announcement..." />
        </label>

        <label class="grid gap-1">
          <span class="label">Link (optional)</span>
          <input v-model="linkUrl" class="input" placeholder="https://..." />
        </label>

        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2">
            <input v-model="isPinned" type="checkbox" />
            <span class="text-sm font-extrabold">Pin</span>
          </label>
          <div class="flex-1" />
          <button class="btn btn-primary" :disabled="loading" @click="postNow">
            {{ loading ? 'Posting...' : 'Post' }}
          </button>
        </div>

        <div class="alert alert-ok">
          Tip: When admins upload new materials/past questions/banks, JabuStudyHub will automatically post a course update to that course channel.
        </div>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
.label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.65);
  font-weight: 800;
}
</style>
