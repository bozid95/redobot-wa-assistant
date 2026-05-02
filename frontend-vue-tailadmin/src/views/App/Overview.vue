<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Overview" />

    <div class="space-y-6">
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="item in metricCards"
          :key="item.label"
          class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ item.label }}</p>
              <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ item.value }}</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ item.note }}</p>
            </div>
            <div class="rounded-xl bg-gray-100 p-2 dark:bg-gray-800">
              <component :is="item.icon" class="size-5 text-gray-700 dark:text-gray-300" />
            </div>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <article class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">WhatsApp</p>
              <h3 class="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">Connection</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ instanceName }}</p>
            </div>
            <Badge :color="connectionBadge.color">{{ connectionBadge.label }}</Badge>
          </div>

          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
              <p class="text-xs font-semibold uppercase text-gray-500">Status</p>
              <p class="mt-2 font-medium text-gray-800 dark:text-white/90">{{ connectionStatus }}</p>
            </div>
            <div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
              <p class="text-xs font-semibold uppercase text-gray-500">Number</p>
              <p class="mt-2 font-medium text-gray-800 dark:text-white/90">{{ phoneNumber }}</p>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <Button :startIcon="RefreshCw" :disabled="loading" @click="loadOverview">Refresh</Button>
            <router-link
              to="/connection"
              class="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              <RadioTower class="size-4" />
              Connection
            </router-link>
          </div>
        </article>

        <article class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div>
            <p class="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Prioritas</p>
            <h3 class="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">Next Action</h3>
          </div>
          <div class="mt-5 space-y-3">
            <router-link
              v-for="item in actions"
              :key="item.to"
              :to="item.to"
              class="block rounded-xl border border-gray-200 px-4 py-4 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-800 dark:hover:border-brand-800 dark:hover:bg-brand-500/5"
            >
              <p class="font-medium text-gray-800 dark:text-white/90">{{ item.title }}</p>
              <p class="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">{{ item.description }}</p>
            </router-link>
          </div>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <article class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Inbox</p>
              <h3 class="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">Recent Conversations</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Pantau chat terbaru dan status penanganannya.</p>
            </div>
            <router-link to="/inbox" class="action-link">Buka Inbox</router-link>
          </div>

          <div class="mt-5 divide-y divide-gray-100 dark:divide-gray-800">
            <p v-if="!recentConversations.length" class="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
              Belum ada conversation terbaru.
            </p>
            <router-link
              v-for="item in recentConversations"
              :key="item.id"
              :to="`/inbox/${item.id}`"
              class="grid grid-cols-1 gap-3 rounded-lg px-2 py-4 transition hover:bg-gray-50 dark:hover:bg-white/[0.02] sm:grid-cols-[minmax(0,1fr)_120px]"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate font-medium text-gray-800 dark:text-white/90">{{ item.name }}</p>
                  <Badge :color="item.status === 'takeover' ? 'warning' : 'success'">{{ item.status === 'takeover' ? 'Takeover' : 'AI aktif' }}</Badge>
                </div>
                <p class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{{ item.message }}</p>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 sm:text-right">{{ item.time }}</p>
            </router-link>
          </div>

          <div v-if="recentConversationsPagination.totalPages > 1" class="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Page {{ recentConversationsPagination.page }} / {{ recentConversationsPagination.totalPages }}
            </p>
            <div class="flex gap-2">
              <button type="button" class="page-btn" :disabled="!recentConversationsPagination.hasPrev || loading" @click="changeConversationPage(-1)">Prev</button>
              <button type="button" class="page-btn" :disabled="!recentConversationsPagination.hasNext || loading" @click="changeConversationPage(1)">Next</button>
            </div>
          </div>
        </article>

        <article class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">AI Readiness</p>
              <h3 class="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">Knowledge Status</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Ringkasan kesiapan data AI.</p>
            </div>
            <Badge :color="knowledgeReady ? 'success' : 'warning'">{{ knowledgeReady ? 'Ready' : 'Cek' }}</Badge>
          </div>

          <div class="mt-5 grid grid-cols-3 gap-3">
            <div v-for="item in knowledgeStats" :key="item.label" class="rounded-xl bg-gray-50 p-4 text-center dark:bg-gray-900">
              <p class="text-xl font-semibold text-gray-800 dark:text-white/90">{{ item.value }}</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ item.label }}</p>
            </div>
          </div>

          <div class="mt-5 space-y-3">
            <div
              v-for="item in readinessItems"
              :key="item.label"
              class="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-800"
            >
              <span class="text-sm text-gray-600 dark:text-gray-300">{{ item.label }}</span>
              <Badge :color="item.ok ? 'success' : 'warning'">{{ item.ok ? 'OK' : 'Cek' }}</Badge>
            </div>
          </div>
        </article>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Quality Queue</p>
            <h3 class="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">Fallback Terbaru</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Pertanyaan yang perlu dipakai untuk memperbaiki pengetahuan AI.</p>
          </div>
          <router-link to="/leads" class="action-link">Buka Leads</router-link>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <p v-if="!fallbackItems.length" class="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400 lg:col-span-3">
            Belum ada fallback terbuka.
          </p>
          <article
            v-for="item in fallbackItems"
            :key="item.id"
            class="rounded-xl border border-gray-200 p-4 transition hover:border-warning-300 hover:bg-warning-50/40 dark:border-gray-800 dark:hover:border-warning-500/40 dark:hover:bg-warning-500/5"
          >
            <div class="flex items-center justify-between gap-3">
              <Badge color="warning">{{ item.reason }}</Badge>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ item.time }}</span>
            </div>
            <p class="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-gray-700 dark:text-gray-200">{{ item.question }}</p>
            <router-link
              :to="`/ai-training?step=knowledge&question=${encodeURIComponent(item.question)}&reason=${encodeURIComponent(item.reason)}&phone=${encodeURIComponent(item.phone)}`"
              class="mt-4 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
            >
              Lengkapi Latih AI
            </router-link>
          </article>
        </div>

        <div v-if="fallbackPagination.totalPages > 1" class="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Page {{ fallbackPagination.page }} / {{ fallbackPagination.totalPages }}
          </p>
          <div class="flex gap-2">
            <button type="button" class="page-btn" :disabled="!fallbackPagination.hasPrev || loading" @click="changeFallbackPage(-1)">Prev</button>
            <button type="button" class="page-btn" :disabled="!fallbackPagination.hasNext || loading" @click="changeFallbackPage(1)">Next</button>
          </div>
        </div>
      </section>
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
  recentConversations?: Array<{
    id: number
    name: string
    phone: string
    status: string
    takeoverEnabled?: boolean
    lastMessageAt?: string
    last_message_at?: string
    message: string
    lastRole?: string | null
    last_role?: string | null
  }>
  recentFallbacks?: Array<{
    id: number
    phone: string
    conversationId?: number | null
    conversation_id?: number | null
    question: string
    reason: string
    status: string
    createdAt?: string
    created_at?: string
  }>
  knowledge?: {
    total?: number
    indexed?: number
    pending?: number
    error?: number
    ready?: boolean
  }
  readiness?: {
    whatsappConnected?: boolean
    knowledgeIndexed?: boolean
    fallbackHealthy?: boolean
  }
  recentConversationsPagination?: PaginationMeta
  recentFallbacksPagination?: PaginationMeta
}

type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
}

const overview = ref<OverviewResponse | null>(null)
const loading = ref(false)
const conversationPage = ref(1)
const conversationLimit = 5
const fallbackPage = ref(1)
const fallbackLimit = 3

async function loadOverview() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      conversationPage: String(conversationPage.value),
      conversationLimit: String(conversationLimit),
      fallbackPage: String(fallbackPage.value),
      fallbackLimit: String(fallbackLimit),
    })
    overview.value = await apiFetch<OverviewResponse>(`/dashboard/overview?${params.toString()}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadOverview)

function timeAgo(value?: string) {
  if (!value) return '-'
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return '-'
  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (diffSeconds < 60) return 'baru saja'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} jam lalu`
  return `${Math.floor(diffHours / 24)} hari lalu`
}

const instanceName = computed(() => overview.value?.instance?.instanceName || overview.value?.instance?.instance_name || 'Belum ada instance')
const connectionStatus = computed(() => String(overview.value?.instance?.status || 'unknown'))
const phoneNumber = computed(() => overview.value?.instance?.phoneNumber || overview.value?.instance?.phone_number || 'Belum terhubung')
const openLeads = computed(() => Number(overview.value?.stats?.openLeads ?? 0))
const takeoverActive = computed(() => Number(overview.value?.stats?.takeoverActive ?? 0))
const knowledgeReady = computed(() => Boolean(overview.value?.knowledge?.ready))

const recentConversations = computed(() =>
  (overview.value?.recentConversations || []).map((item) => ({
    id: item.id,
    name: item.name || item.phone,
    message: item.message || 'Belum ada pesan',
    status: item.status,
    time: timeAgo(item.lastMessageAt || item.last_message_at),
  })),
)

const knowledgeStats = computed(() => [
  { label: 'Artikel', value: Number(overview.value?.knowledge?.total ?? 0) },
  { label: 'Indexed', value: Number(overview.value?.knowledge?.indexed ?? 0) },
  { label: 'Pending', value: Number(overview.value?.knowledge?.pending ?? 0) + Number(overview.value?.knowledge?.error ?? 0) },
])

const readinessItems = computed(() => [
  { label: 'WhatsApp connected', ok: Boolean(overview.value?.readiness?.whatsappConnected) },
  { label: 'Knowledge indexed', ok: Boolean(overview.value?.readiness?.knowledgeIndexed) },
  { label: 'Fallback rendah', ok: Boolean(overview.value?.readiness?.fallbackHealthy) },
])

const fallbackItems = computed(() =>
  (overview.value?.recentFallbacks || []).map((item) => ({
    id: item.id,
    phone: item.phone,
    reason: item.reason,
    time: timeAgo(item.createdAt || item.created_at),
    question: item.question,
  })),
)

const recentConversationsPagination = computed<PaginationMeta>(() => overview.value?.recentConversationsPagination || {
  page: conversationPage.value,
  limit: conversationLimit,
  total: 0,
  totalPages: 1,
  hasPrev: false,
  hasNext: false,
})

const fallbackPagination = computed<PaginationMeta>(() => overview.value?.recentFallbacksPagination || {
  page: fallbackPage.value,
  limit: fallbackLimit,
  total: 0,
  totalPages: 1,
  hasPrev: false,
  hasNext: false,
})

async function changeConversationPage(delta: number) {
  const next = conversationPage.value + delta
  if (next < 1 || next > recentConversationsPagination.value.totalPages) return
  conversationPage.value = next
  await loadOverview()
}

async function changeFallbackPage(delta: number) {
  const next = fallbackPage.value + delta
  if (next < 1 || next > fallbackPagination.value.totalPages) return
  fallbackPage.value = next
  await loadOverview()
}

const metricCards = computed(() => [
  { label: 'Chat Hari Ini', value: overview.value?.stats?.chatsToday ?? 0, icon: MessageCircleMore, note: 'Pesan pelanggan masuk' },
  { label: 'Fallback Hari Ini', value: overview.value?.stats?.fallbackToday ?? 0, icon: CircleAlert, note: 'Butuh perbaikan knowledge' },
  { label: 'Takeover Aktif', value: takeoverActive.value, icon: Hand, note: 'Sedang ditangani admin' },
  { label: 'Open Leads', value: openLeads.value, icon: Sparkles, note: 'Belum ditutup' },
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

<style scoped>
.action-link {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
  padding: 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(55 65 81);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.action-link:hover {
  background: rgb(249 250 251);
}

.dark .action-link {
  border-color: rgb(31 41 55);
  color: rgb(229 231 235);
}

.dark .action-link:hover {
  background: rgb(17 24 39);
}

.page-btn {
  min-height: 2rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
  padding: 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(55 65 81);
}

.page-btn:hover:not(:disabled) {
  background: rgb(249 250 251);
}

.page-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.dark .page-btn {
  border-color: rgb(31 41 55);
  color: rgb(229 231 235);
}

.dark .page-btn:hover:not(:disabled) {
  background: rgb(17 24 39);
}
</style>
