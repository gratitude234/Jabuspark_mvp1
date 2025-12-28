import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Import only tailwind.css (it will import design.css internally)
import './styles/tailwind.css'

createApp(App).use(createPinia()).use(router).mount('#app')
