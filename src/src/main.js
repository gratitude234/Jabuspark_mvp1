import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Import only tailwind.css (it will import design.css internally)
import './styles/tailwind.css'

// PWA (service worker + install/update helpers)
import './pwa/register'

createApp(App).use(createPinia()).use(router).mount('#app')
