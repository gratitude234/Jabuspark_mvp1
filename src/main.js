import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Import only tailwind.css (it will import design.css internally)
import './styles/tailwind.css'

// PWA (service worker)
import './pwa.js'

createApp(App).use(createPinia()).use(router).mount('#app')