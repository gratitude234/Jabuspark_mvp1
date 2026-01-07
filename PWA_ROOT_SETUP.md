# PWA Root Setup (needed outside /src)

This zip contains frontend source updates for:
- Service worker registration (`src/pwa/register.js`)
- Install banner + update prompt + offline UX
- Offline route (`/offline`)

To make it a true installable PWA, you still need PWA build output from your project root.

## If you use Vite (recommended)

1) Install:
   npm i -D vite-plugin-pwa

2) Add PWA plugin to `vite.config.js`:

   import { VitePWA } from 'vite-plugin-pwa'

   plugins: [
     vue(),
     VitePWA({
       registerType: 'prompt',
       manifest: { ... },
       workbox: {
         navigateFallback: '/',
         runtimeCaching: [
           {
             urlPattern: ({ url }) => url.pathname.startsWith('/api/uploads/'),
             handler: 'CacheFirst',
             options: { cacheName: 'uploads-cache' }
           },
           {
             urlPattern: ({ url, request }) =>
               request.method === 'GET' &&
               url.pathname.startsWith('/api/') &&
               !url.pathname.startsWith('/api/auth/'),
             handler: 'NetworkFirst',
             options: { cacheName: 'api-cache', networkTimeoutSeconds: 4 }
           }
         ]
       }
     })
   ]

3) Add icons to `public/icons/` (192/512 + maskable).

## Notes
- PWA requires HTTPS in production (localhost is OK for dev).
- Avoid caching auth endpoints (`/api/auth/*`).
