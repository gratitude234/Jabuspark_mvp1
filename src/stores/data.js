import { defineStore } from 'pinia'
import { storage } from '../utils/storage'
import { apiFetch } from '../utils/api'
import { toast } from '../utils/toast'

const seed = () => ({
  progress: {
    streak: 0,
    accuracy: 0,
    totalAnswered: 0,
    correctAnswered: 0,
    studySeconds: 0,
    lastActive: null,
    // Gamification
    dailyGoal: 10,
    todayAnswered: 0,
    todayCorrect: 0,
    xp: 0,
    level: 1,
    badges: [],
    badgesNew: [],
    levelUp: false,
    saved: { pastQuestions: [], materials: [], questions: [] },
    notifyUnread: 0,
  },
  answers: {}, // { [bankId]: { answeredIds:[], correctIds:[] } }
  courseProgress: [],
  courseTrends: {}, // { [courseId]: [{date,attempts,accuracy}] }
  reviewQueue: [],

  // Killer features
  leaderboard: { week: '', courseId: '', items: [], me: null },
  exam: { exam: null, questions: [], result: null },

  // JabuNotify
  notify: { channels: [], feed: [], unreadTotal: 0 },
  groups: { my: [], pending: 0, current: null, members: [], challenges: [], challenge: null, scoreboard: [], result: null },
})

export const useDataStore = defineStore('data', {
  state: () => ({
    ...seed(),
    loading: {
      progress: false,
    },
    error: null,
  }),
  actions: {
    async bootstrap() {
      // prefer server, fallback to storage if offline
      const cached = storage.get('progress', null)
      const cachedAns = storage.get('answers', null)
      if (cached) this.progress = cached
      if (cachedAns) this.answers = cachedAns

      await this.fetchProgress()
    },

    async fetchProgress() {
      this.loading.progress = true
      this.error = null
      try {
        const res = await apiFetch('/progress')
        this.progress = res?.data?.progress || seed().progress
        this.answers = res?.data?.answers || {}
        storage.set('progress', this.progress)
        storage.set('answers', this.answers)
      } catch (e) {
        this.error = e?.message || 'Failed to load progress'
        // keep cached data if available
      } finally {
        this.loading.progress = false
      }
    },

    async toggleSave(kind, itemId) {
      const res = await apiFetch('/save/toggle', {
        method: 'POST',
        body: { kind, id: itemId }
      })
      const saved = !!res?.data?.saved

      const list = this.progress.saved?.[kind] || []
      const has = list.includes(itemId)
      if (saved && !has) list.push(itemId)
      if (!saved && has) {
        const idx = list.indexOf(itemId)
        if (idx >= 0) list.splice(idx, 1)
      }
      this.progress.saved = { ...this.progress.saved, [kind]: list }
      storage.set('progress', this.progress)
      return saved
    },

    async fetchCourseProgress() {
      const res = await apiFetch('/progress/courses')
      this.courseProgress = res?.data?.courses || []
      return this.courseProgress
    },

    async fetchCourseTrend(courseId, { days = 14 } = {}) {
      const qs = new URLSearchParams({ courseId: String(courseId || ''), days: String(days) })
      const res = await apiFetch(`/progress/trend?${qs.toString()}`)
      const pts = res?.data?.points || []
      this.courseTrends = { ...this.courseTrends, [courseId]: pts }
      return pts
    },

    async fetchReviewQueue({ courseId = '', limit = 25 } = {}) {
      const qs = new URLSearchParams({ limit: String(limit) })
      if (courseId) qs.set('courseId', courseId)
      const res = await apiFetch(`/practice/review?${qs.toString()}`)
      this.reviewQueue = res?.data?.questions || []
      return this.reviewQueue
    },

    isSaved(kind, itemId) {
      return (this.progress.saved?.[kind] || []).includes(itemId)
    },

    applyProgress(p) {
      if (!p) return
      this.progress = { ...this.progress, ...p }
      storage.set('progress', this.progress)
      if (p.levelUp) toast(`Level up! You are now Level ${p.level}.`, 'ok')
      if (Array.isArray(p.badgesNew) && p.badgesNew.length) {
        p.badgesNew.forEach((k) => toast(`Badge unlocked: ${String(k).replace(/_/g, ' ')}`, 'ok'))
      }
    },

    async submitAnswer({ bankId, questionId, selectedIndex, secondsSpent = 0 }) {
      const res = await apiFetch('/practice/submit', {
        method: 'POST',
        body: { bankId, questionId, selectedIndex, secondsSpent }
      })
      const p = res?.data?.progress
      const bankStats = res?.data?.bankStats

      if (p) {
        this.progress = { ...this.progress, ...p }
        storage.set('progress', this.progress)

        // Toasts for motivation (safe even if backend doesn't send these)
        if (p.levelUp) toast(`Level up! You are now Level ${p.level}.`, 'ok')
        if (Array.isArray(p.badgesNew) && p.badgesNew.length) {
          p.badgesNew.forEach((k) => toast(`Badge unlocked: ${k.replace(/_/g, ' ')}`, 'ok'))
        }
      }
      if (bankStats) {
        this.answers = { ...this.answers, [bankId]: bankStats }
        storage.set('answers', this.answers)
      }
      return res?.data
    },

    async setDailyGoal(dailyGoal) {
      const g = Math.max(5, Math.min(200, Number(dailyGoal) || 10))
      const res = await apiFetch('/gamification/goal', {
        method: 'POST',
        body: { dailyGoal: g }
      })

      // Update locally even if migration isn't run on server
      this.progress = { ...this.progress, dailyGoal: (res?.data?.dailyGoal ?? g) }
      storage.set('progress', this.progress)
      toast('Daily goal updated.', 'ok')
      return this.progress.dailyGoal
    },

    async resetBank(bankId) {
      await apiFetch('/practice/reset', { method: 'POST', body: { bankId } })
      const next = { ...this.answers }
      delete next[bankId]
      this.answers = next
      storage.set('answers', this.answers)
      return true
    },

    async fetchLeaderboard({ courseId = '', limit = 50 } = {}) {
      const qs = new URLSearchParams({ limit: String(limit) })
      if (courseId) qs.set('courseId', String(courseId))
      const res = await apiFetch(`/leaderboard/weekly?${qs.toString()}`)
      this.leaderboard = {
        week: res?.data?.week || '',
        courseId: res?.data?.courseId || courseId || '',
        items: res?.data?.items || [],
        me: res?.data?.me || null,
      }
      return this.leaderboard
    },

    async startExam({ courseId, count = 40, durationMins = 60 } = {}) {
      const qs = new URLSearchParams({ courseId: String(courseId || ''), count: String(count), durationMins: String(durationMins) })
      const res = await apiFetch(`/exam/start?${qs.toString()}`)
      this.exam = { exam: res?.data?.exam || null, questions: res?.data?.questions || [], result: null }
      return this.exam
    },

    async getExam(examId) {
      const qs = new URLSearchParams({ examId: String(examId || '') })
      const res = await apiFetch(`/exam/get?${qs.toString()}`)
      this.exam = { exam: res?.data?.exam || null, questions: res?.data?.questions || [], result: this.exam?.result || null }
      return this.exam
    },

    async submitExam({ examId, answers = {}, secondsTotal = 0 } = {}) {
      const res = await apiFetch('/exam/submit', {
        method: 'POST',
        body: { examId, answers, secondsTotal }
      })

      // progress updates & motivation toasts
      const p = res?.data?.progress
      if (p) {
        this.progress = { ...this.progress, ...p }
        storage.set('progress', this.progress)
        if (p.levelUp) toast(`Level up! You are now Level ${p.level}.`, 'ok')
        if (Array.isArray(p.badgesNew) && p.badgesNew.length) {
          p.badgesNew.forEach((k) => toast(`Badge unlocked: ${k.replace(/_/g, ' ')}`, 'ok'))
        }
      }

      this.exam = { ...this.exam, result: res?.data || null }
      return res?.data
    },

    // ----------------------------
    // JabuNotify (Announcements)
    // ----------------------------
    async fetchNotifyChannels() {
      const res = await apiFetch('/notify/channels')
      const channels = res?.data?.channels || []
      const unreadTotal = Number(res?.data?.unreadTotal || 0)
      this.notify = { ...this.notify, channels, unreadTotal }

      // mirror into progress for top-bar badge
      this.progress = { ...this.progress, notifyUnread: unreadTotal }
      storage.set('progress', this.progress)
      return channels
    },

    async toggleNotifyFollow(channelId, follow = null) {
      const res = await apiFetch('/notify/follow', { method: 'POST', body: { channelId, follow } })
      const isFollowed = !!res?.data?.isFollowed
      const channels = (this.notify.channels || []).map((c) => (c.id === channelId ? { ...c, isFollowed } : c))
      this.notify = { ...this.notify, channels }
      return isFollowed
    },

    async fetchNotifyFeed({ limit = 25, channelId = '' } = {}) {
      const qs = new URLSearchParams({ limit: String(limit) })
      if (channelId) qs.set('channelId', String(channelId))
      const res = await apiFetch(`/notify/feed?${qs.toString()}`)
      const feed = res?.data?.posts || []
      this.notify = { ...this.notify, feed }
      return feed
    },

    async markNotifyRead(postId) {
      await apiFetch('/notify/read', { method: 'POST', body: { postId } })

      const feed = (this.notify.feed || []).map((p) => (p.id === postId ? { ...p, isRead: true } : p))
      this.notify = { ...this.notify, feed }

      // update badge counts optimistically
      const current = Number(this.progress.notifyUnread || 0)
      this.progress = { ...this.progress, notifyUnread: Math.max(0, current - 1) }
      storage.set('progress', this.progress)
      return true
    },

    async markAllNotifyRead({ channelId = '' } = {}) {
      await apiFetch('/notify/read', { method: 'POST', body: { all: true, channelId: channelId || undefined } })
      // refresh channels to update unread counts
      await Promise.allSettled([this.fetchNotifyChannels(), this.fetchNotifyFeed({ channelId })])
      return true
    },


    // ----------------------------
    // Study Groups + Challenges
    // ----------------------------
    async fetchGroupsMy() {
      try {
        const res = await apiFetch('/groups/my')
        this.groups.my = res?.data?.groups || []
        return this.groups.my
      } catch (e) {
        this.groups.my = []
        throw e
      }
    },

    async fetchGroupBadge() {
      try {
        const res = await apiFetch('/groups/badge')
        this.groups.pending = Number(res?.data?.pending || 0)
        return this.groups.pending
      } catch (e) {
        this.groups.pending = 0
        return 0
      }
    },

    async createGroup(name) {
      const res = await apiFetch('/groups/create', { method: 'POST', body: { name } })
      toast('Group created', 'ok')
      await this.fetchGroupsMy()
      await this.fetchGroupBadge()
      return res?.data?.group
    },

    async joinGroup(code) {
      const res = await apiFetch('/groups/join', { method: 'POST', body: { code } })
      toast('Joined group', 'ok')
      await this.fetchGroupsMy()
      await this.fetchGroupBadge()
      return res?.data?.group
    },

    async leaveGroup(groupId) {
      await apiFetch('/groups/leave', { method: 'POST', body: { groupId } })
      toast('Left group', 'ok')
      await this.fetchGroupsMy()
      await this.fetchGroupBadge()
      return true
    },

    async getGroup(groupId) {
      const res = await apiFetch(`/groups/get?groupId=${encodeURIComponent(groupId)}`)
      this.groups.current = res?.data?.group || null
      this.groups.members = res?.data?.members || []
      return res?.data
    },

    async listGroupChallenges(groupId) {
      const res = await apiFetch(`/groups/challenge/list?groupId=${encodeURIComponent(groupId)}`)
      this.groups.challenges = res?.data?.challenges || []
      await this.fetchGroupBadge()
      return this.groups.challenges
    },

    async createGroupChallenge({ groupId, title, courseId, count = 20, durationMins = 20 }) {
      const res = await apiFetch('/groups/challenge/create', {
        method: 'POST',
        body: { groupId, title, courseId, count, durationMins },
      })
      toast('Challenge created', 'ok')
      await this.listGroupChallenges(groupId)
      await this.fetchGroupsMy()
      await this.fetchGroupBadge()
      return res?.data?.challenge
    },

    async getChallenge(challengeId) {
      const res = await apiFetch(`/challenge/get?challengeId=${encodeURIComponent(challengeId)}`)
      this.groups.challenge = res?.data || null
      return res?.data
    },

    async submitChallenge({ challengeId, answers, secondsTotal = 0 }) {
      const res = await apiFetch('/challenge/submit', {
        method: 'POST',
        body: { challengeId, answers, secondsTotal },
      })
      if (res?.data?.progress) this.applyProgress(res.data.progress)
      this.groups.result = res?.data || null
      try { storage.set(`challenge_result:${challengeId}`, this.groups.result) } catch (e) {}
      await this.fetchGroupBadge()
      return res?.data
    },

    async getChallengeScoreboard(challengeId) {
      const res = await apiFetch(`/challenge/scoreboard?challengeId=${encodeURIComponent(challengeId)}`)
      this.groups.scoreboard = res?.data?.items || []
      return this.groups.scoreboard
    },

    async adminCreateNotifyPost({ channelId, title, body, linkUrl = '', isPinned = false } = {}) {
      const res = await apiFetch('/notify/post', { method: 'POST', body: { channelId, title, body, linkUrl, isPinned } })
      return res?.data?.post || null
    }
  }
})
