import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import AuthLayout from '../layouts/AuthLayout.vue'
import AppShell from '../layouts/AppShell.vue'

import Login from '../pages/Login.vue'
import Onboarding from '../pages/Onboarding.vue'
import Dashboard from '../pages/Dashboard.vue'
import PastQuestions from '../pages/PastQuestions.vue'
import Materials from '../pages/Materials.vue'
import Practice from '../pages/Practice.vue'
import Profile from '../pages/Profile.vue'

// Admin + uploads
import RepRequest from '../pages/RepRequest.vue'
import Uploads from '../pages/Uploads.vue'
import AdminRepRequests from '../pages/AdminRepRequests.vue'
import AdminCourseReps from '../pages/AdminCourseReps.vue'
import AdminAiTools from '../pages/AdminAiTools.vue'
import AdminUploadLogs from '../pages/AdminUploadLogs.vue'

// ✅ Practice home (so /practice is a real page)
import PracticeHome from '../pages/PracticeHome.vue'

// ✅ NEW
import Saved from '../pages/Saved.vue'

const routes = [
  {
    path: '/auth',
    component: AuthLayout,
    children: [
      { path: 'login', component: Login, meta: { title: 'Login' } },
    ],
  },
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '', redirect: '/dashboard' },

      { path: 'onboarding', component: Onboarding, meta: { title: 'Onboarding' } },
      { path: 'dashboard', component: Dashboard, meta: { title: 'Dashboard' } },
      { path: 'past-questions', component: PastQuestions, meta: { title: 'Past Questions' } },
      { path: 'materials', component: Materials, meta: { title: 'Materials' } },

      // ✅ so nav "/practice" never 404s (until you create PracticeHome)
      { path: 'practice', component: PracticeHome, meta: { title: 'Practice' } },
      { path: 'practice/:bankId', component: Practice, props: true, meta: { title: 'Practice' } },

      // ✅ NEW
      { path: 'saved', component: Saved, meta: { title: 'Saved' } },

      { path: 'profile', component: Profile, meta: { title: 'Profile' } },

      // Course rep onboarding + uploads
      { path: 'rep/request', component: RepRequest, meta: { title: 'Course Rep Request' } },
      { path: 'uploads', component: Uploads, meta: { title: 'Uploads', roles: ['admin', 'course_rep'] } },

      // Admin
      { path: 'admin/rep-requests', component: AdminRepRequests, meta: { title: 'Rep Requests', roles: ['admin'] } },
      { path: 'admin/course-reps', component: AdminCourseReps, meta: { title: 'Manage Course Reps', roles: ['admin'] } },
      { path: 'admin/ai-tools', component: AdminAiTools, meta: { title: 'AI Tools', roles: ['admin'] } },
      { path: 'admin/upload-logs', component: AdminUploadLogs, meta: { title: 'Upload Audit Log', roles: ['admin'] } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const publicPaths = ['/auth/login']
  const needsAuth = !publicPaths.includes(to.path)

  if (needsAuth && !auth.isAuthed) return '/auth/login'
  if (auth.isAuthed && auth.needsOnboarding && to.path !== '/onboarding') return '/onboarding'

  // Role-based guard
  const roles = to.meta?.roles
  if (roles && Array.isArray(roles)) {
    const r = auth.user?.role || 'student'
    if (!roles.includes(r)) return '/dashboard'
  }
  return true
})

export default router
