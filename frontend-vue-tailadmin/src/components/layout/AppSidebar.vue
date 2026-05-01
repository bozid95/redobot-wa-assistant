<template>
  <aside
    :class="[
      'fixed mt-16 top-0 left-0 z-99999 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 lg:mt-0',
      {
        'lg:w-[290px]': isExpanded || isMobileOpen || isHovered,
        'lg:w-[90px]': !isExpanded && !isHovered,
        'translate-x-0 w-[290px]': isMobileOpen,
        '-translate-x-full': !isMobileOpen,
        'lg:translate-x-0': true,
      },
    ]"
    @mouseenter="!isExpanded && (isHovered = true)"
    @mouseleave="isHovered = false"
  >
    <div :class="['flex py-8', !isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start']">
      <router-link to="/">
        <img
          v-if="isExpanded || isHovered || isMobileOpen"
          class="dark:hidden"
          src="/images/logo/logo.svg"
          alt="Logo"
          width="150"
          height="40"
        />
        <img
          v-if="isExpanded || isHovered || isMobileOpen"
          class="hidden dark:block"
          src="/images/logo/logo-dark.svg"
          alt="Logo"
          width="150"
          height="40"
        />
        <img v-else src="/images/logo/logo-icon.svg" alt="Logo" width="32" height="32" />
      </router-link>
    </div>

    <div class="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
      <nav class="mb-6">
        <div class="flex flex-col gap-4">
          <div v-for="(menuGroup, groupIndex) in menuGroups" :key="groupIndex">
            <h2
              :class="[
                'mb-4 flex text-xs uppercase leading-[20px] text-gray-400',
                !isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start',
              ]"
            >
              <template v-if="isExpanded || isHovered || isMobileOpen">
                {{ menuGroup.title }}
              </template>
              <HorizontalDots v-else />
            </h2>

            <ul class="flex flex-col gap-4">
              <li v-for="item in menuGroup.items" :key="item.name">
                <router-link
                  :to="item.path"
                  :class="[
                    'menu-item group',
                    {
                      'menu-item-active': isActive(item.path),
                      'menu-item-inactive': !isActive(item.path),
                    },
                  ]"
                >
                  <span :class="[isActive(item.path) ? 'menu-item-icon-active' : 'menu-item-icon-inactive']">
                    <component :is="item.icon" />
                  </span>
                  <span v-if="isExpanded || isHovered || isMobileOpen" class="menu-item-text">{{ item.name }}</span>
                </router-link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <SidebarWidget v-if="isExpanded || isHovered || isMobileOpen" />
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { GridIcon, HorizontalDots, PlugInIcon } from '../../icons'
import { Inbox, RadioTower, BookOpenText, Users, Building2, UserCircle2 } from 'lucide-vue-next'
import SidebarWidget from './SidebarWidget.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const { isExpanded, isMobileOpen, isHovered } = useSidebar()
const auth = useAuth()

const menuGroups = computed(() => {
  const groups = [
    {
      title: 'Menu',
      items: [
        { icon: GridIcon, name: 'Overview', path: '/' },
        { icon: RadioTower, name: 'Connection', path: '/connection' },
        { icon: Inbox, name: 'Inbox', path: '/inbox' },
        { icon: BookOpenText, name: 'Knowledge', path: '/knowledge' },
        { icon: Users, name: 'Leads', path: '/leads' },
      ],
    },
    {
      title: 'Account',
      items: [{ icon: UserCircle2, name: 'Profile', path: '/profile' }],
    },
  ]

  if (auth.user.value?.role === 'admin') {
    groups.push({
      title: 'Management',
      items: [
        { icon: Building2, name: 'Tenants', path: '/tenants' },
        { icon: Users, name: 'Users', path: '/users' },
      ],
    })
  }

  groups.push({
    title: 'Session',
    items: [{ icon: PlugInIcon, name: 'Login', path: '/login' }],
  })

  return groups
})

const isActive = (path) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>
