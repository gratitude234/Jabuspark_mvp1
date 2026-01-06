<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import { toast } from '../utils/toast'

const router = useRouter()
const data = useDataStore()

const loading = ref(false)
const error = ref('')

const createName = ref('')
const joinCode = ref('')

const groups = computed(() => data.groups?.my || [])
const pendingTotal = computed(() => Number(data.groups?.pending || 0))

async function load() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([data.fetchGroupsMy(), data.fetchGroupBadge()])
  } catch (e) {
    error.value = e?.message || 'Failed to load groups'
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function doCreate() {
  const name = createName.value.trim()
  if (name.length < 3) return toast('Group name is too short.', 'warn')
  loading.value = true
  error.value = ''
  try {
    const g = await data.createGroup(name)
    createName.value = ''
    if (g?.id) router.push(`/groups/${g.id}`)
  } catch (e) {
    error.value = e?.message || 'Failed to create group'
  } finally {
    loading.value = false
  }
}

async function doJoin() {
  const code = joinCode.value.trim().toUpperCase()
  if (code.length < 4) return toast('Enter a valid join code.', 'warn')
  loading.value = true
  error.value = ''
  try {
    const g = await data.joinGroup(code)
    joinCode.value = ''
    if (g?.id) router.push(`/groups/${g.id}`)
  } catch (e) {
    error.value = e?.message || 'Failed to join group'
  } finally {
    loading.value = false
  }
}

function copy(text) {
  try {
    navigator.clipboard?.writeText(String(text || ''))
    toast('Copied.', 'ok')
  } catch (e) {
    toast('Copy failed.', 'warn')
  }
}
</script>

<template>
  <div class="page grid gap-4">
    <AppCard>
      <div class="row">
        <div>
          <div class="h1">Study Groups</div>
          <p class="sub mt-1">Create a group, invite friends, and take the same timed challenges.</p>
        </div>
        <div class="badge">{{ pendingTotal }} pending</div>
      </div>

      <div v-if="error" class="alert alert-warn mt-4" role="alert">{{ error }}</div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="card card-pad">
          <div class="text-sm font-extrabold">Create a group</div>
          <p class="sub mt-1">You become the owner and can create challenges.</p>
          <div class="mt-3 flex gap-2">
            <input v-model="createName" class="input flex-1" placeholder="e.g. CSC 300 Squad" />
            <button class="btn btn-primary" :disabled="loading" @click="doCreate">Create</button>
          </div>
        </div>

        <div class="card card-pad">
          <div class="text-sm font-extrabold">Join with code</div>
          <p class="sub mt-1">Ask the group owner for the join code.</p>
          <div class="mt-3 flex gap-2">
            <input v-model="joinCode" class="input flex-1 uppercase" placeholder="AB12CD" />
            <button class="btn btn-primary" :disabled="loading" @click="doJoin">Join</button>
          </div>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <div class="row">
        <div>
          <div class="h2">My groups</div>
          <p class="sub mt-1">Tap a group to see members and challenges.</p>
        </div>
        <button class="btn btn-ghost" :disabled="loading" @click="load">Refresh</button>
      </div>

      <div class="divider my-4" />

      <div v-if="loading && groups.length === 0" class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>

      <div v-else-if="groups.length === 0" class="alert alert-ok" role="status">
        You’re not in any groups yet. Create one or join using a code.
      </div>

      <div v-else class="grid gap-2">
        <RouterLink
          v-for="g in groups"
          :key="g.id"
          :to="`/groups/${g.id}`"
          class="card card-press card-pad"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-extrabold truncate">{{ g.name }}</div>
              <div class="text-xs text-text-3 mt-1">
                {{ g.membersCount }} members •
                <span class="badge">{{ g.myRole }}</span>
                <span v-if="g.pendingChallenges > 0" class="badge ml-2">{{ g.pendingChallenges }} pending</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs text-text-3">Join code</div>
              <button type="button" class="btn btn-ghost btn-sm mt-1" @click.prevent="copy(g.joinCode)">
                {{ g.joinCode }}
              </button>
            </div>
          </div>
        </RouterLink>
      </div>
    </AppCard>
  </div>
</template>
