// PWA registration + events used by UI components.
// Requires vite-plugin-pwa (see vite.config.js)
import { registerSW } from 'virtual:pwa-register'

let ready = false

const updateSW = registerSW({
  immediate: true,
  onOfflineReady() {
    if (ready) return
    ready = true
    window.dispatchEvent(new CustomEvent('pwa:offline-ready'))
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pwa:need-refresh'))
  },
  onRegisteredSW(_swUrl, registration) {
    // expose a manual update hook (used by UpdateToast)
    if (registration) {
      window.__PWA_REGISTRATION__ = registration
    }
  },
})

// expose a global update function for convenience
window.__PWA_UPDATE__ = () => updateSW(true)
