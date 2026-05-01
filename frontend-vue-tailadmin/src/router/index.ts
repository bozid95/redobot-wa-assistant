import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { left: 0, top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'Overview',
      component: () => import('../views/App/Overview.vue'),
      meta: {
        title: 'Overview',
        requiresAuth: true,
      },
    },
    {
      path: '/connection',
      name: 'Connection',
      component: () => import('../views/App/Connection.vue'),
      meta: {
        title: 'Connection',
        requiresAuth: true,
      },
    },
    {
      path: '/inbox',
      name: 'Inbox',
      component: () => import('../views/App/Inbox.vue'),
      meta: {
        title: 'Inbox',
        requiresAuth: true,
      },
    },
    {
      path: '/inbox/:id',
      name: 'Inbox Detail',
      component: () => import('../views/App/InboxDetail.vue'),
      meta: {
        title: 'Conversation',
        requiresAuth: true,
      },
    },
    {
      path: '/knowledge',
      name: 'Knowledge',
      component: () => import('../views/App/KnowledgeList.vue'),
      meta: {
        title: 'Knowledge',
        requiresAuth: true,
      },
    },
    {
      path: '/knowledge/new',
      name: 'Knowledge New',
      component: () => import('../views/App/KnowledgeEditor.vue'),
      meta: {
        title: 'New Knowledge',
        requiresAuth: true,
      },
    },
    {
      path: '/knowledge/:id/edit',
      name: 'Knowledge Edit',
      component: () => import('../views/App/KnowledgeEditor.vue'),
      meta: {
        title: 'Edit Knowledge',
        requiresAuth: true,
      },
    },
    {
      path: '/leads',
      name: 'Leads',
      component: () => import('../views/App/Leads.vue'),
      meta: {
        title: 'Leads',
        requiresAuth: true,
      },
    },
    {
      path: '/profile',
      name: 'Profile',
      component: () => import('../views/App/Profile.vue'),
      meta: {
        title: 'Profile',
        requiresAuth: true,
      },
    },
    {
      path: '/tenants',
      name: 'Tenants',
      component: () => import('../views/App/Tenants.vue'),
      meta: {
        title: 'Tenants',
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/users',
      name: 'Users',
      component: () => import('../views/App/Users.vue'),
      meta: {
        title: 'Users',
        requiresAuth: true,
        requiresAdmin: true,
      },
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Auth/Signin.vue'),
      meta: {
        title: 'Login',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  document.title = `${to.meta.title || 'App'} | redobot WA Asisten`

  const auth = useAuth()

  if (to.meta.requiresAuth) {
    await auth.fetchMe()
    if (!auth.user.value) {
      next('/login')
      return
    }
  }

  if (to.meta.requiresAdmin) {
    await auth.fetchMe()
    if (!auth.user.value || auth.user.value.role !== 'admin') {
      next('/')
      return
    }
  }

  if (to.path === '/login') {
    await auth.fetchMe()
    if (auth.user.value) {
      next('/')
      return
    }
  }

  next()
})

export default router
