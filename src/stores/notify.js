import { defineStore } from 'pinia'
import { apiFetch } from '../utils/api'

export const useNotifyStore = defineStore('notify', {
  state: () => ({
    channels: [],
    followedChannelIds: [],
    unreadCount: 0,
    bootstrapped: false,
  }),
  getters: {
    isFollowing: (s) => (id) => s.followedChannelIds.includes(id),
    channelById: (s) => (id) => s.channels.find((c) => c.id === id) || null,
  },
  actions: {
    async bootstrap() {
      if (this.bootstrapped) return
      this.bootstrapped = true
      await this.refreshSummary()
    },
    async refreshSummary() {
      const res = await apiFetch('/notify/summary')
      this.channels = res?.data?.channels || []
      this.followedChannelIds = res?.data?.followedChannelIds || []
      this.unreadCount = Number(res?.data?.unreadCount || 0)
    },
    async fetchPosts({ channelId = '', unread = false, limit = 25, offset = 0 } = {}) {
      const params = new URLSearchParams()
      if (channelId) params.set('channelId', channelId)
      if (unread) params.set('unread', '1')
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      const res = await apiFetch(`/notify/posts?${params.toString()}`)
      return res?.data?.posts || []
    },
    async toggleFollow(channelId, follow) {
      const res = await apiFetch('/notify/follow', {
        method: 'POST',
        body: { channelId, follow: !!follow },
      })
      this.followedChannelIds = res?.data?.followedChannelIds || []
      this.unreadCount = Number(res?.data?.unreadCount || 0)
    },
    async markRead({ postIds = [], markAll = false } = {}) {
      const res = await apiFetch('/notify/read', {
        method: 'POST',
        body: { postIds, markAll },
      })
      // refresh unread count cheaply
      await this.refreshSummary()
      return res?.data
    },

    // admin helpers
    async adminCreateChannel({ name, slug, scopeType = 'general', scopeId = null }) {
      const res = await apiFetch('/admin/notify/channels', {
        method: 'POST',
        body: { name, slug, scopeType, scopeId },
      })
      await this.refreshSummary()
      return res?.data
    },
    async adminCreatePost(payload) {
      const res = await apiFetch('/admin/notify/posts', { method: 'POST', body: payload })
      return res?.data
    },
    async adminDeletePost(id) {
      await apiFetch(`/admin/notify/posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
  },
})
