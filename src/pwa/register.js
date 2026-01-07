// PWA registration (works with vite-plugin-pwa or any build that outputs /sw.js)
// - Registers SW when available
// - Emits window events for UI components:
//   - 'pwa:update' when a new version is waiting
//   - 'pwa:offline' and 'pwa:online' on connectivity changes

function canRegisterSW() {
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  return 'serviceWorker' in navigator && (window.location.protocol === 'https:' || isLocalhost)
}

async function registerServiceWorker() {
  if (!canRegisterSW()) return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')

    // If there's already a waiting worker (rare but possible)
    if (reg.waiting && navigator.serviceWorker.controller) {
      window.dispatchEvent(new CustomEvent('pwa:update', { detail: { registration: reg } }))
    }

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing
      if (!worker) return
      worker.addEventListener('statechange', () => {
        // installed + controller means "update available"
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('pwa:update', { detail: { registration: reg } }))
        }
      })
    })

    // When SW takes control, reload once so the new assets are used
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  } catch (e) {
    // non-fatal
    // console.warn('SW register failed', e)
  }
}

function wireOnlineOfflineEvents() {
  const emit = (name) => window.dispatchEvent(new CustomEvent(name))
  window.addEventListener('online', () => emit('pwa:online'))
  window.addEventListener('offline', () => emit('pwa:offline'))
}

// Register on load (after first paint)
window.addEventListener('load', () => {
  wireOnlineOfflineEvents()
  registerServiceWorker()
})
