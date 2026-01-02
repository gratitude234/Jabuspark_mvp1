import { defineStore } from 'pinia'
import { storage } from '../utils/storage'
import { apiFetch } from '../utils/api'
import { toast } from '../utils/toast'

const seed = () => ({
  progress: {
    streak: 0,
    streakFreezes: 0,
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
    missionsClaimable: 0,
  },
  answers: {}, // { [bankId]: { answeredIds:[], correctIds:[] } }
  courseProgress: [],
  courseTrends: {}, // { [courseId]: [{date,attempts,accuracy}] }
  reviewQueue: [],

  // Killer features
  leaderboard: { week: '', courseId: '', items: [], me: null },
  exam: { exam: null, questions: [], result: null },
  missions: { weekStart: '', items: [], claimable: 0 },

  // JabuNotify
  notify: { channels: [], feed: [], unreadTotal: 0 },
  groups: { my: [], pending: 0, current: null, members: [], challenges: [], challenge: null, scoreboard: [], result: null },

  // 1v1 Duel (shareable challenge links)
  duel: { duel: null, participants: [], questions: [], result: null },
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
      // Missions is optional; ignore if backend migration isn't on server yet.
      try { await this.fetchMissions() } catch (_) {}
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

    // ----------------------------
    // Weekly Missions + Streak Freeze
    // ----------------------------
    async fetchMissions() {
      const res = await apiFetch('/gamification/missions')
      const weekStart = res?.data?.weekStart || ''
      const items = res?.data?.missions || []
      const claimable = Number(res?.data?.claimable || 0)
      this.missions = { weekStart, items, claimable }

      // mirror into progress for quick badge updates
      this.progress = { ...this.progress, streakFreezes: Number(res?.data?.streakFreezes || this.progress.streakFreezes || 0), missionsClaimable: claimable }
      storage.set('progress', this.progress)
      return this.missions
    },

    async claimMission(missionKey) {
      const res = await apiFetch('/gamification/missions/claim', {
        method: 'POST',
        body: { missionKey }
      })
      const data = res?.data || {}
      this.missions = {
        weekStart: data.weekStart || this.missions.weekStart,
        items: data.missions || this.missions.items,
        claimable: Number(data.claimable || 0),
      }

      // apply server progress snapshot (xp/level/streakFreezes)
      if (data.progress) this.applyProgress(data.progress)

      const rxp = Number(data?.rewards?.xp || 0)
      const rfz = Number(data?.rewards?.streakFreezes || 0)
      if (rxp || rfz) {
        toast(`Claimed: +${rxp} XP${rfz ? ` • +${rfz} Streak Freeze` : ''}`, 'ok')
      } else {
        toast('Mission claimed.', 'ok')
      }
      return this.missions
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
      if (typeof p.missionsClaimable === 'number') {
        this.missions = { ...this.missions, claimable: Number(p.missionsClaimable) || 0 }
      }
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

        if (typeof p.missionsClaimable === 'number') {
          this.missions = { ...this.missions, claimable: Number(p.missionsClaimable) || 0 }
        }

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

        if (typeof p.missionsClaimable === 'number') {
          this.missions = { ...this.missions, claimable: Number(p.missionsClaimable) || 0 }
        }
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
    _notifySetUnreadTotal(total) {
      const t = Math.max(0, Number(total) || 0)
      this.notify = { ...this.notify, unreadTotal: t }
      // mirror into progress for top-bar badge
      this.progress = { ...this.progress, notifyUnread: t }
      storage.set('progress', this.progress)
      return t
    },

    _notifyBumpChannelUnread(channelId, delta) {
      const d = Number(delta) || 0
      if (!channelId || !d) return
      const channels = (this.notify.channels || []).map((c) => {
        if (c.id !== channelId) return c
        const next = Math.max(0, Number(c.unreadCount || 0) + d)
        return { ...c, unreadCount: next }
      })
      this.notify = { ...this.notify, channels }
    },

    async fetchNotifyChannels() {
      const res = await apiFetch('/notify/channels')
      const channels = res?.data?.channels || []
      const unreadTotal = Number(res?.data?.unreadTotal || 0)

      this.notify = { ...this.notify, channels, unreadTotal }
      this._notifySetUnreadTotal(unreadTotal)
      return channels
    },

    async toggleNotifyFollow(channelId, follow = null) {
      const res = await apiFetch('/notify/follow', { method: 'POST', body: { channelId, follow } })
      const isFollowed = !!res?.data?.isFollowed

      // optimistic local update (keeps UI snappy even before next refresh)
      const prev = (this.notify.channels || []).find((c) => c.id === channelId)
      const prevUnread = Number(prev?.unreadCount || 0)

      const channels = (this.notify.channels || []).map((c) => {
        if (c.id !== channelId) return c
        // if user unfollows, treat unread as 0 since it won't count anymore
        const nextUnread = isFollowed ? Number(c.unreadCount || 0) : 0
        return { ...c, isFollowed, unreadCount: nextUnread }
      })
      this.notify = { ...this.notify, channels }

      // adjust global unread only when unfollowing (following may add unread we don't know yet)
      if (!isFollowed && prevUnread) this._notifySetUnreadTotal(Number(this.notify.unreadTotal || 0) - prevUnread)

      return isFollowed
    },

    async fetchNotifyFeed({ limit = 25, channelId = '' } = {}) {
      const qs = new URLSearchParams({ limit: String(limit) })
      if (channelId) qs.set('channelId', String(channelId))
      const res = await apiFetch(`/notify/feed?${qs.toString()}`)
      const feed = res?.data?.posts || []

      // Keep feed in store (UI decides grouping/pinning)
      this.notify = { ...this.notify, feed }
      return feed
    },

    async markNotifyRead(postId) {
      // find first so we can update counts accurately
      const prevPost = (this.notify.feed || []).find((p) => p.id === postId)
      const wasUnread = prevPost && !prevPost.isRead
      const chId = prevPost?.channelId

      await apiFetch('/notify/read', { method: 'POST', body: { postId } })

      // Update feed
      const feed = (this.notify.feed || []).map((p) => (p.id === postId ? { ...p, isRead: true } : p))
      this.notify = { ...this.notify, feed }

      // Update badge counts optimistically (only if this post was unread)
      if (wasUnread) {
        this._notifySetUnreadTotal(Number(this.notify.unreadTotal || 0) - 1)
        if (chId) this._notifyBumpChannelUnread(chId, -1)
      }

      return true
    },

    async markAllNotifyRead({ channelId = '' } = {}) {
      // optimistic UI update
      const cid = channelId ? String(channelId) : ''
      const feed = (this.notify.feed || []).map((p) => {
        if (!cid || p.channelId === cid) return { ...p, isRead: true }
        return p
      })
      this.notify = { ...this.notify, feed }

      if (cid) {
        // subtract that channel's unread from total
        const ch = (this.notify.channels || []).find((c) => c.id === cid)
        const chUnread = Number(ch?.unreadCount || 0)
        if (chUnread) this._notifySetUnreadTotal(Number(this.notify.unreadTotal || 0) - chUnread)

        const channels = (this.notify.channels || []).map((c) => (c.id === cid ? { ...c, unreadCount: 0 } : c))
        this.notify = { ...this.notify, channels }
      } else {
        // global mark all
        const channels = (this.notify.channels || []).map((c) => ({ ...c, unreadCount: 0 }))
        this.notify = { ...this.notify, channels }
        this._notifySetUnreadTotal(0)
      }

      await apiFetch('/notify/read', { method: 'POST', body: { all: true, channelId: cid || undefined } })

      // refresh channels+feed to ensure server truth (pinned, expiry, etc)
      await Promise.allSettled([this.fetchNotifyChannels(), this.fetchNotifyFeed({ channelId: cid })])
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

    // ----------------------------
    // 1v1 Duel (shareable challenge links)
    // ----------------------------
    async createDuel({ bankId, questionCount = 10, durationMins = 10 } = {}) {
      const res = await apiFetch('/duel/create', {
        method: 'POST',
        body: { bankId, questionCount, durationMins },
      })
      const duel = res?.data?.duel || null
      if (duel) {
        this.duel = { ...this.duel, duel, participants: [], questions: [], result: null }
        toast('Duel link created. Share it with a friend.', 'ok')
      }
      return duel
    },

    async getDuel(code) {
      const res = await apiFetch(`/duel/get?code=${encodeURIComponent(code)}`)
      this.duel = {
        ...this.duel,
        duel: res?.data?.duel || null,
        participants: res?.data?.participants || [],
      }
      return res?.data
    },

    async startDuel(code) {
      const res = await apiFetch(`/duel/start?code=${encodeURIComponent(code)}`)
      this.duel = {
        ...this.duel,
        duel: res?.data?.duel || this.duel.duel,
        participants: res?.data?.participants || this.duel.participants,
        questions: res?.data?.questions || [],
      }
      return res?.data
    },

    async submitDuel({ code, answers = {}, secondsTotal = 0 } = {}) {
      const res = await apiFetch('/duel/submit', {
        method: 'POST',
        body: { code, answers, secondsTotal },
      })
      if (res?.data?.rewards?.xp) toast(`+${Number(res.data.rewards.xp)} XP`, 'ok')
      this.duel = { ...this.duel, result: res?.data || null }
      return res?.data
    },

    async getDuelResult(code) {
      const res = await apiFetch(`/duel/result?code=${encodeURIComponent(code)}`)
      this.duel = {
        ...this.duel,
        duel: res?.data?.duel || this.duel.duel,
        participants: res?.data?.participants || this.duel.participants,
        result: res?.data || null,
      }
      return res?.data
    },

    async adminCreateNotifyPost({ channelId, title, body, linkUrl = '', isPinned = false } = {}) {
      const res = await apiFetch('/notify/post', { method: 'POST', body: { channelId, title, body, linkUrl, isPinned } })
      return res?.data?.post || null
    }
  }
})
