import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import AuthLayout from '../layouts/AuthLayout.vue'
import AppShell from '../layouts/AppShell.vue'

import Login from '../pages/Login.vue'
import ForgotPassword from '../pages/ForgotPassword.vue'
import Offline from '../pages/Offline.vue'

// Practice engine (core)
import PracticeHome from '../pages/PracticeHome.vue'
import Practice from '../pages/Practice.vue'
import TheoryTake from '../pages/TheoryTake.vue'
import Review from '../pages/Review.vue'

// Optional downloads (kept)
import PastQuestions from '../pages/PastQuestions.vue'

// Supporting
import Saved from '../pages/Saved.vue'
import Progress from '../pages/Progress.vue'
import Profile from '../pages/Profile.vue'

// Admin / internal tools (kept; not part of student nav)
import Uploads from '../pages/Uploads.vue'
import AdminAiTools from '../pages/AdminAiTools.vue'
import AdminRepRequests from '../pages/AdminRepRequests.vue'
import AdminCourseReps from '../pages/AdminCourseReps.vue'
import AdminUploadLogs from '../pages/AdminUploadLogs.vue'

const routes = [
  {
    path: '/auth',
    component: AuthLayout,
    children: [
      { path: 'login', component: Login, meta: { title: 'Login' } },
      { path: 'forgot', component: ForgotPassword, meta: { title: 'Reset Password' } },
    ],
  },
  {
    path: '/offline',
    component: Offline,
    meta: { title: 'Offline' },
  },
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '', redirect: '/practice' },

      // Core practice engine
      { path: 'practice', component: PracticeHome, meta: { title: 'Practice' } },
      { path: 'practice/review', component: Review, meta: { title: 'Review' } },
      { path: 'practice/theory/:bankId', component: TheoryTake, props: true, meta: { title: 'Theory Practice' } },
      { path: 'practice/:bankId', component: Practice, props: true, meta: { title: 'Practice' } },

      // Optional downloads
      { path: 'past-questions', component: PastQuestions, meta: { title: 'Past Questions' } },

      // Supporting
      { path: 'saved', component: Saved, meta: { title: 'Saved' } },
      { path: 'progress', component: Progress, meta: { title: 'Progress' } },
      { path: 'profile', component: Profile, meta: { title: 'Profile' } },

      // Uploads (admin / course_rep)
      { path: 'uploads', component: Uploads, meta: { title: 'Uploads', roles: ['admin', 'course_rep'] } },

      // Admin
      { path: 'admin/ai-tools', component: AdminAiTools, meta: { title: 'AI Tools', roles: ['admin'] } },
      { path: 'admin/rep-requests', component: AdminRepRequests, meta: { title: 'Rep Requests', roles: ['admin'] } },
      { path: 'admin/course-reps', component: AdminCourseReps, meta: { title: 'Course Reps', roles: ['admin'] } },
      { path: 'admin/upload-logs', component: AdminUploadLogs, meta: { title: 'Upload Logs', roles: ['admin'] } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/practice' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const isPublic = to.path.startsWith('/auth') || to.path === '/offline'

  // Ensure store is hydrated before guarding routes
  if (!auth.bootstrapped) {
    try { await auth.hydrate() } catch (e) { /* ignore */ }
  }

  // Auth gate
  if (!isPublic && !auth.isAuthed) {
    return { path: '/auth/login', query: { next: to.fullPath } }
  }

  // Role-based guard (admin / course_rep pages)
  const roles = to.meta?.roles
  if (roles && Array.isArray(roles) && roles.length) {
    const r = auth.role
    if (!roles.includes(r)) {
      if (to.path.startsWith('/uploads')) return { path: '/profile', hash: '#uploads-reps' }
      return { path: '/practice' }
    }
  }

  return true
})

export default router
