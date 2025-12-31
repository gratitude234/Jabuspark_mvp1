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
import Review from '../pages/Review.vue'
import Progress from '../pages/Progress.vue'
import Profile from '../pages/Profile.vue'

// ✅ NEW killer features
import Leaderboard from '../pages/Leaderboard.vue'
import ExamHome from '../pages/ExamHome.vue'
import ExamTake from '../pages/ExamTake.vue'
import ExamResult from '../pages/ExamResult.vue'

// ✅ NEW: Weekly Missions
import Missions from '../pages/Missions.vue'

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

// ✅ NEW: Announcements
import Notify from '../pages/Notify.vue'
import AdminNotify from '../pages/AdminNotify.vue'

// ✅ Study Groups
import Groups from '../pages/Groups.vue'
import GroupDetail from '../pages/GroupDetail.vue'
import GroupChallengeNew from '../pages/GroupChallengeNew.vue'
import ChallengeTake from '../pages/ChallengeTake.vue'
import ChallengeResult from '../pages/ChallengeResult.vue'

// ✅ 1v1 Duel (shareable challenge links)
import DuelLobby from '../pages/DuelLobby.vue'
import DuelTake from '../pages/DuelTake.vue'
import DuelResult from '../pages/DuelResult.vue'

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
      { path: 'practice/review', component: Review, meta: { title: 'Smart Review' } },
      { path: 'practice/:bankId', component: Practice, props: true, meta: { title: 'Practice' } },

      // ✅ NEW
      { path: 'saved', component: Saved, meta: { title: 'Saved' } },

      // ✅ NEW: Announcements
      { path: 'notify', component: Notify, meta: { title: 'Announcements' } },

      // ✅ Study Groups
      { path: 'groups', component: Groups, meta: { title: 'Study Groups' } },
      { path: 'groups/:groupId', component: GroupDetail, props: true, meta: { title: 'Group' } },
      { path: 'groups/:groupId/new-challenge', component: GroupChallengeNew, props: true, meta: { title: 'New Challenge' } },
      { path: 'challenge/:challengeId', component: ChallengeTake, props: true, meta: { title: 'Challenge' } },
      { path: 'challenge/:challengeId/result', component: ChallengeResult, props: true, meta: { title: 'Challenge Result' } },

      // ✅ 1v1 Duel
      { path: 'duel/:code', component: DuelLobby, props: true, meta: { title: '1v1 Duel' } },
      { path: 'duel/:code/take', component: DuelTake, props: true, meta: { title: 'Duel' } },
      { path: 'duel/:code/result', component: DuelResult, props: true, meta: { title: 'Duel Result' } },

      // ✅ NEW killer features
      { path: 'leaderboard', component: Leaderboard, meta: { title: 'Leaderboard' } },
      { path: 'missions', component: Missions, meta: { title: 'Weekly Missions' } },
      { path: 'exam', component: ExamHome, meta: { title: 'Exam Mode' } },
      { path: 'exam/:examId', component: ExamTake, props: true, meta: { title: 'Exam' } },
      { path: 'exam/:examId/result', component: ExamResult, props: true, meta: { title: 'Exam Result' } },

      { path: 'progress', component: Progress, meta: { title: 'Progress' } },
      { path: 'profile', component: Profile, meta: { title: 'Profile' } },

      // Course rep onboarding + uploads
      { path: 'rep/request', component: RepRequest, meta: { title: 'Course Rep Request' } },
      { path: 'uploads', component: Uploads, meta: { title: 'Uploads', roles: ['admin', 'course_rep'] } },

      // Admin
      { path: 'admin/rep-requests', component: AdminRepRequests, meta: { title: 'Rep Requests', roles: ['admin'] } },
      { path: 'admin/course-reps', component: AdminCourseReps, meta: { title: 'Manage Course Reps', roles: ['admin'] } },
      { path: 'admin/ai-tools', component: AdminAiTools, meta: { title: 'AI Tools', roles: ['admin'] } },
      { path: 'admin/upload-logs', component: AdminUploadLogs, meta: { title: 'Upload Audit Log', roles: ['admin'] } },
      { path: 'admin/notify', component: AdminNotify, meta: { title: 'Post Announcement', roles: ['admin'] } },
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

  if (needsAuth && !auth.isAuthed) {
    return { path: '/auth/login', query: { next: to.fullPath } }
  }
  if (auth.isAuthed && auth.needsOnboarding && to.path !== '/onboarding') {
    return { path: '/onboarding', query: { next: to.fullPath } }
  }

  // Role-based guard
  const roles = to.meta?.roles
  if (roles && Array.isArray(roles)) {
    const r = auth.user?.role || 'student'
    if (!roles.includes(r)) return '/dashboard'
  }
  return true
})

export default router
