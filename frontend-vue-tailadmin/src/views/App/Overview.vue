<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Overview" />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="item in metricCards"
        :key="item.label"
        class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ item.label }}</p>
          <div class="rounded-xl bg-gray-100 p-2 dark:bg-gray-800">
            <component :is="item.icon" class="size-5 text-gray-700 dark:text-gray-300" />
          </div>
        </div>
        <p class="mt-4 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ item.value }}</p>
      </div>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Connection</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ instanceName }}</p>
          </div>
          <Badge :color="connectionBadge.color">{{ connectionBadge.label }}</Badge>
        </div>

        <div class="mt-6 grid gap-4 sm:grid-cols-2">
          <div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">Status</p>
            <p class="mt-2 font-medium text-gray-800 dark:text-white/90">{{ connectionStatus }}</p>
          </div>
          <div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">Number</p>
            <p class="mt-2 font-medium text-gray-800 dark:text-white/90">{{ phoneNumber }}</p>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap gap-3">
          <Button :startIcon="RefreshCw" :disabled="loading" @click="loadOverview">Refresh</Button>
          <router-link
            to="/connection"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            <RadioTower class="size-4" />
            Connection
          </router-link>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Next</h3>
        <div class="mt-4 space-y-3">
          <router-link
            v-for="item in actions"
            :key="item.to"
            :to="item.to"
            class="block rounded-xl border border-gray-200 px-4 py-4 hover:border-brand-300 dark:border-gray-800 dark:hover:border-brand-800"
          >
            <p class="font-medium text-gray-800 dark:text-white/90">{{ item.title }}</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ item.description }}</p>
          </router-link>
        </div>
      </div>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { MessageCircleMore, CircleAlert, Hand, Sparkles, RefreshCw, RadioTower } from 'lucide-vue-next'
import { apiFetch } from '@/lib/api'

type OverviewResponse = {
  instance?: {
    instanceName?: string
    instance_name?: string
    status?: string
    phoneNumber?: string
    phone_number?: string
  }
  stats?: {
    chatsToday?: number
    fallbackToday?: number
    takeoverActive?: number
    openLeads?: number
  }
}

const overview = ref<OverviewResponse | null>(null)
const loading = ref(false)

async function loadOverview() {
  loading.value = true
  try {
    overview.value = await apiFetch<OverviewResponse>('/dashboard/overview')
  } finally {
    loading.value = false
  }
}

onMounted(loadOverview)

const instanceName = computed(() => overview.value?.instance?.instanceName || overview.value?.instance?.instance_name || 'Belum ada instance')
const connectionStatus = computed(() => String(overview.value?.instance?.status || 'unknown'))
const phoneNumber = computed(() => overview.value?.instance?.phoneNumber || overview.value?.instance?.phone_number || 'Belum terhubung')
const openLeads = computed(() => Number(overview.value?.stats?.openLeads ?? 0))
const takeoverActive = computed(() => Number(overview.value?.stats?.takeoverActive ?? 0))

const metricCards = computed(() => [
  { label: 'Chat Hari Ini', value: overview.value?.stats?.chatsToday ?? 0, icon: MessageCircleMore },
  { label: 'Fallback Hari Ini', value: overview.value?.stats?.fallbackToday ?? 0, icon: CircleAlert },
  { label: 'Takeover Aktif', value: takeoverActive.value, icon: Hand },
  { label: 'Open Leads', value: openLeads.value, icon: Sparkles },
])

const connectionBadge = computed(() => {
  const status = connectionStatus.value.toLowerCase()
  if (status === 'connected') return { label: 'Connected', color: 'success' as const }
  if (['connecting', 'qr', 'pairing'].includes(status)) return { label: connectionStatus.value, color: 'warning' as const }
  return { label: connectionStatus.value, color: 'light' as const }
})

const actions = computed(() => {
  const items: Array<{ to: string; title: string; description: string }> = []
  if (connectionStatus.value.toLowerCase() !== 'connected') {
    items.push({ to: '/connection', title: 'Pulihkan koneksi', description: 'Selesaikan pairing atau buat instance baru.' })
  }
  if (openLeads.value > 0) {
    items.push({ to: '/leads', title: `${openLeads.value} lead terbuka`, description: 'Prioritaskan fallback yang belum ditindaklanjuti.' })
  }
  if (takeoverActive.value > 0) {
    items.push({ to: '/inbox', title: `${takeoverActive.value} takeover aktif`, description: 'Pastikan thread selesai dikembalikan ke bot.' })
  }
  if (!items.length) {
    items.push({ to: '/knowledge', title: 'Perbarui knowledge', description: 'Tambah atau rapikan artikel untuk meningkatkan jawaban bot.' })
  }
  return items
})
</script>
