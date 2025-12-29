<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import AppCard from '../components/AppCard.vue'
import { toast } from '../utils/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const data = useDataStore()

const groupId = computed(() => String(route.params.groupId || ''))
const loading = ref(false)
const error = ref('')

const group = computed(() => data.groups?.current || null)
const members = computed(() => data.groups?.members || [])
const challenges = computed(() => data.groups?.challenges || [])
const isOwner = computed(() => (group.value?.myRole || '') === 'owner')

async function load() {
  if (!groupId.value) return
  loading.value = true
  error.value = ''
  try {
    await Promise.all([
      data.getGroup(groupId.value),
      data.listGroupChallenges(groupId.value),
    ])
  } catch (e) {
    error.value = e?.message || 'Failed to load group'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(groupId, load)

function copy(text) {
  try {
    navigator.clipboard?.writeText(String(text || ''))
    toast('Copied.', 'ok')
  } catch (e) {
    toast('Copy failed.', 'warn')
  }
}

async function leave() {
  if (!groupId.value) return
  loading.value = true
  error.value = ''
  try {
    await data.leaveGroup(groupId.value)
    router.replace('/groups')
  } catch (e) {
    error.value = e?.message || 'Failed to leave group'
  } finally {
    loading.value = false
  }
}

function openChallenge(ch) {
  if (!ch?.id) return
  router.push(`/challenge/${ch.id}`)
}
</script>

<template>
  <div class="page grid gap-4">
    <AppCard>
      <div class="row">
        <div class="min-w-0">
          <div class="h1 truncate">{{ group?.name || 'Group' }}</div>
          <p class="sub mt-1">
            <span class="badge">{{ group?.myRole || 'member' }}</span>
            <span class="text-text-3">•</span>
            {{ members.length }} members
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-ghost" :disabled="loading" @click="load">Refresh</button>
          <button class="btn btn-ghost" :disabled="loading" @click="leave">Leave</button>
        </div>
      </div>

      <div v-if="error" class="alert alert-warn mt-4" role="alert">{{ error }}</div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="card card-pad">
          <div class="text-sm font-extrabold">Invite code</div>
          <p class="sub mt-1">Share this code so others can join.</p>
          <button class="btn btn-primary btn-lg mt-3 w-full" type="button" @click="copy(group?.joinCode)">
            {{ group?.joinCode || '—' }}
          </button>
        </div>

        <div class="card card-pad">
          <div class="text-sm font-extrabold">Group actions</div>
          <p class="sub mt-1">Create timed challenges and compare scores.</p>
          <div class="mt-3 flex flex-col gap-2">
            <RouterLink v-if="isOwner" :to="`/groups/${groupId}/new-challenge`" class="btn btn-primary">
              Create challenge
            </RouterLink>
            <RouterLink to="/practice/review" class="btn btn-ghost">Smart Review</RouterLink>
            <RouterLink to="/leaderboard" class="btn btn-ghost">Global Leaderboard</RouterLink>
          </div>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <div class="row">
        <div>
          <div class="h2">Challenges</div>
          <p class="sub mt-1">Take a challenge once. Your best score shows on the board.</p>
        </div>
      </div>

      <div class="divider my-4" />

      <div v-if="loading && challenges.length === 0" class="grid gap-2">
        <div class="skeleton h-16" />
        <div class="skeleton h-16" />
      </div>

      <div v-else-if="challenges.length === 0" class="alert alert-ok" role="status">
        No challenges yet. <span v-if="isOwner">Create one to get everyone competing.</span>
      </div>

      <div v-else class="grid gap-2">
        <div
          v-for="c in challenges"
          :key="c.id"
          class="card card-pad"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-extrabold truncate">{{ c.title }}</div>
              <div class="text-xs text-text-3 mt-1">
                <span class="font-semibold">{{ c.courseCode }}</span> • {{ c.totalQuestions }} questions • {{ c.durationMins }} mins
              </div>
              <div class="text-xs text-text-3 mt-1">
                <span v-if="c.myAttempt?.submittedAt" class="badge">Submitted</span>
                <span v-else class="badge">Pending</span>
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">
              <button
                v-if="!c.myAttempt?.submittedAt"
                class="btn btn-primary btn-sm"
                @click="openChallenge(c)"
              >Start</button>
              <RouterLink
                v-else
                :to="`/challenge/${c.id}/result`"
                class="btn btn-ghost btn-sm"
              >View</RouterLink>
              <RouterLink :to="`/challenge/${c.id}/result`" class="btn btn-ghost btn-sm">Scoreboard</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <div class="row">
        <div>
          <div class="h2">Members</div>
          <p class="sub mt-1">Owner appears first.</p>
        </div>
      </div>

      <div class="divider my-4" />

      <div v-if="members.length === 0" class="alert alert-ok" role="status">
        No members found.
      </div>

      <div v-else class="grid gap-2">
        <div v-for="m in members" :key="m.id" class="card card-pad">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-extrabold truncate">{{ m.fullName }}</div>
              <div class="text-xs text-text-3 mt-1">{{ m.role }}</div>
            </div>
            <div class="badge">{{ m.groupRole }}</div>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
