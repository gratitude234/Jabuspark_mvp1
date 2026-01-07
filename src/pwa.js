// PWA Service Worker registration
// - Shows a simple 'Update available' confirm dialog
// - Lets users work offline with cached content (see vite.config.js runtimeCaching)
import { registerSW } from 'virtual:pwa-register'

export const updateSW = registerSW({
  immediate: true,

  onNeedRefresh() {
    // Minimal UX: prompt user to reload for latest version
    const ok = window.confirm('A new version of JabuStudyHub is available. Reload now?')
    if (ok) updateSW(true)
  },

  onOfflineReady() {
    // Optional: you can replace with an in-app toast later
    console.log('JabuStudyHub is ready to work offline.')
  },
})
