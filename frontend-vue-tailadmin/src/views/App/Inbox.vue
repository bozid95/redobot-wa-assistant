<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Inbox" />

    <div class="space-y-6">
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Percakapan</p>
          <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ pagination.total }}</p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Open Halaman Ini</p>
          <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ statusCount.open }}</p>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Takeover Halaman Ini</p>
          <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ statusCount.takeover }}</p>
        </div>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="border-b border-gray-200 p-5 dark:border-gray-800">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 class="font-semibold text-gray-800 dark:text-white/90">Daftar Inbox</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Pantau percakapan pelanggan dan buka chat yang butuh tindak lanjut.</p>
            </div>

            <div class="flex flex-col gap-3 lg:flex-row">
              <div class="relative min-w-[280px]">
                <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  v-model="search"
                  type="text"
                  placeholder="Cari nomor atau nama"
                  class="form-control pl-10"
                  @keyup.enter="applyFilters"
                />
              </div>
              <select v-model="status" class="form-control lg:w-[180px]" @change="applyFilters">
                <option value="">Semua Status</option>
                <option value="open">Open</option>
                <option value="takeover">Takeover</option>
                <option value="closed">Closed</option>
              </select>
              <div class="flex gap-3">
                <Button variant="outline" :startIcon="RefreshCw" :disabled="loading" @click="loadData">
                  {{ loading ? 'Loading...' : 'Refresh' }}
                </Button>
                <Button :disabled="loading" @click="applyFilters">Cari</Button>
              </div>
            </div>
          </div>
        </div>

        <div class="custom-scrollbar max-w-full overflow-x-auto">
          <table class="min-w-full table-fixed">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60">
                <th class="w-[34%] px-5 py-3 text-left sm:px-6">
                  <p class="table-head">Pelanggan</p>
                </th>
                <th class="w-[34%] px-5 py-3 text-left sm:px-6">
                  <p class="table-head">Pesan Terakhir</p>
                </th>
                <th class="w-[14%] px-5 py-3 text-left sm:px-6">
                  <p class="table-head">Status</p>
                </th>
                <th class="w-[12%] px-5 py-3 text-left sm:px-6">
                  <p class="table-head">Waktu</p>
                </th>
                <th class="w-[6%] px-5 py-3 text-right sm:px-6">
                  <p class="table-head">Aksi</p>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
              <tr
                v-for="conversation in conversations"
                :key="conversation.id"
                class="transition hover:bg-gray-50 dark:hover:bg-white/[0.03]"
              >
                <td class="px-5 py-4 align-top sm:px-6">
                  <div class="flex min-w-0 items-center gap-3">
                    <div class="flex size-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                      {{ initialFor(conversation) }}
                    </div>
                    <div class="min-w-0">
                      <p class="truncate font-medium text-gray-800 text-theme-sm dark:text-white/90">{{ labelFor(conversation) }}</p>
                      <p class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{{ conversation.phone || '-' }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-4 align-top sm:px-6">
                  <div class="min-w-0">
                    <p class="line-clamp-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{{ previewText(conversation) }}</p>
                    <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{{ messageMeta(conversation) }}</p>
                  </div>
                </td>
                <td class="px-5 py-4 align-top sm:px-6">
                  <Badge :color="statusColor(conversation.status)">{{ statusLabel(conversation.status) }}</Badge>
                </td>
                <td class="px-5 py-4 align-top sm:px-6">
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ timeLabel(conversation) }}</p>
                </td>
                <td class="px-5 py-4 text-right align-top sm:px-6">
                  <router-link :to="`/inbox/${conversation.id}`">
                    <Button size="sm" variant="outline">Buka</Button>
                  </router-link>
                </td>
              </tr>
              <tr v-if="loading">
                <td colspan="5" class="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400 sm:px-6">
                  Memuat percakapan...
                </td>
              </tr>
              <tr v-else-if="!conversations.length">
                <td colspan="5" class="px-5 py-12 text-center sm:px-6">
                  <p class="font-medium text-gray-800 dark:text-white/90">Tidak ada percakapan</p>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Coba ubah filter atau refresh inbox.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Halaman {{ pagination.page }} dari {{ pagination.totalPages }} · {{ pagination.total }} percakapan</span>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" :disabled="loading || !pagination.hasPrev" @click="goToPage(pagination.page - 1)">Prev</Button>
            <Button size="sm" variant="outline" :disabled="loading || !pagination.hasNext" @click="goToPage(pagination.page + 1)">Next</Button>
          </div>
        </div>
      </section>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RefreshCw, Search } from 'lucide-vue-next'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { apiFetch } from '@/lib/api'
import { defaultPagination, type PaginatedResponse, type PaginationMeta } from '@/lib/pagination'

type Message = { id: number; message: string; role?: string; createdAt?: string; created_at?: string }
type Conversation = {
  id: number
  customerName?: string
  customer_name?: string
  phone?: string
  status?: string
  lastMessageAt?: string
  last_message_at?: string
  messages?: Message[]
}

const route = useRoute()
const router = useRouter()
const search = ref(String(route.query.search || ''))
const status = ref(String(route.query.status || ''))
const page = ref(Number(route.query.page || 1))
const conversations = ref<Conversation[]>([])
const pagination = ref<PaginationMeta>(defaultPagination(10))
const loading = ref(false)

const statusCount = computed(() => ({
  open: conversations.value.filter((item) => item.status === 'open').length,
  takeover: conversations.value.filter((item) => item.status === 'takeover').length,
}))

async function loadData() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (search.value) params.set('search', search.value)
    if (status.value) params.set('status', status.value)
    params.set('page', String(page.value))
    params.set('limit', String(pagination.value.limit))
    const suffix = params.toString() ? `?${params.toString()}` : ''
    const response = await apiFetch<PaginatedResponse<Conversation>>(`/conversations${suffix}`)
    conversations.value = response.items
    pagination.value = response.pagination
  } finally {
    loading.value = false
  }
}

async function applyFilters() {
  page.value = 1
  await router.replace({
    path: '/inbox',
    query: {
      search: search.value || undefined,
      status: status.value || undefined,
      page: page.value > 1 ? String(page.value) : undefined,
    },
  })
  await loadData()
}

async function goToPage(nextPage: number) {
  page.value = Math.max(1, nextPage)
  await router.replace({
    path: '/inbox',
    query: {
      search: search.value || undefined,
      status: status.value || undefined,
      page: page.value > 1 ? String(page.value) : undefined,
    },
  })
  await loadData()
}

onMounted(loadData)

function labelFor(conversation: Conversation) {
  return conversation.customerName || conversation.customer_name || conversation.phone || 'Unknown'
}

function initialFor(conversation: Conversation) {
  return labelFor(conversation).trim().charAt(0).toUpperCase() || '?'
}

function previewText(conversation: Conversation) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : []
  const lastMessage = messages[0] || messages[messages.length - 1]
  return lastMessage?.message || 'Belum ada preview pesan.'
}

function messageMeta(conversation: Conversation) {
  const message = Array.isArray(conversation.messages) ? conversation.messages[0] : null
  if (!message?.role) return 'Preview percakapan'
  if (message.role === 'user') return 'Pesan dari pelanggan'
  if (message.role === 'assistant') return 'Dibalas AI'
  if (message.role === 'admin') return 'Dibalas operator'
  return 'Pesan sistem'
}

function statusColor(status?: string) {
  if (status === 'open') return 'success'
  if (status === 'takeover') return 'warning'
  return 'light'
}

function statusLabel(status?: string) {
  if (status === 'open') return 'Open'
  if (status === 'takeover') return 'Takeover'
  if (status === 'closed') return 'Closed'
  return 'Unknown'
}

function timeLabel(conversation: Conversation) {
  const message = Array.isArray(conversation.messages) ? conversation.messages[0] : null
  const value = message?.createdAt || message?.created_at || conversation.lastMessageAt || conversation.last_message_at
  if (!value) return '-'

  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.form-control {
  height: 2.75rem;
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid rgb(209 213 219);
  background: transparent;
  padding: 0 1rem;
  font-size: 0.875rem;
  color: rgb(31 41 55);
  outline: none;
}

.form-control:focus {
  border-color: rgb(70 95 255);
  box-shadow: 0 0 0 3px rgb(70 95 255 / 0.1);
}

.dark .form-control {
  border-color: rgb(55 65 81);
  background: rgb(17 24 39);
  color: rgb(243 244 246);
}

.table-head {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(107 114 128);
}

.dark .table-head {
  color: rgb(156 163 175);
}
</style>
