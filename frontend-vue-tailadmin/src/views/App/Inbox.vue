<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Inbox" />

    <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div class="flex flex-col gap-4 border-b border-gray-200 p-6 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[320px_200px]">
          <input
            v-model="search"
            type="text"
            placeholder="Cari nomor atau nama"
            class="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <select
            v-model="status"
            class="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="">Semua Status</option>
            <option value="open">Open</option>
            <option value="takeover">Takeover</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <Button variant="outline" :startIcon="RefreshCw" :disabled="loading" @click="loadData">Refresh</Button>
      </div>

      <div class="custom-scrollbar max-w-full overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-800">
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Customer</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Phone</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Status</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Last message</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Actions</p>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            <tr v-for="conversation in conversations" :key="conversation.id">
              <td class="px-5 py-4 align-top sm:px-6">
                <p class="min-w-[180px] font-medium text-gray-800 text-theme-sm dark:text-white/90">{{ labelFor(conversation) }}</p>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <p class="min-w-[140px] text-gray-500 text-theme-sm dark:text-gray-400">{{ conversation.phone || '-' }}</p>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <Badge :color="statusColor(conversation.status)">{{ conversation.status || 'unknown' }}</Badge>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <p class="min-w-[280px] max-w-[420px] text-gray-500 text-theme-sm dark:text-gray-400">{{ previewText(conversation) }}</p>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <router-link :to="`/inbox/${conversation.id}`">
                  <Button size="sm" variant="outline">Open</Button>
                </router-link>
              </td>
            </tr>
            <tr v-if="!conversations.length">
              <td colspan="5" class="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400 sm:px-6">
                Tidak ada percakapan.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RefreshCw } from 'lucide-vue-next'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { apiFetch } from '@/lib/api'

type Message = { id: number; message: string }
type Conversation = {
  id: number
  customerName?: string
  customer_name?: string
  phone?: string
  status?: string
  messages?: Message[]
}

const route = useRoute()
const router = useRouter()
const search = ref(String(route.query.search || ''))
const status = ref(String(route.query.status || ''))
const conversations = ref<Conversation[]>([])
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (search.value) params.set('search', search.value)
    if (status.value) params.set('status', status.value)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    conversations.value = await apiFetch<Conversation[]>(`/conversations${suffix}`)
  } finally {
    loading.value = false
  }
}

watch([search, status], async () => {
  await router.replace({
    path: '/inbox',
    query: {
      search: search.value || undefined,
      status: status.value || undefined,
    },
  })
  await loadData()
})

onMounted(loadData)

function labelFor(conversation: Conversation) {
  return conversation.customerName || conversation.customer_name || conversation.phone || 'Unknown'
}

function previewText(conversation: Conversation) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : []
  const lastMessage = messages[messages.length - 1]
  return lastMessage?.message || messages[0]?.message || 'Belum ada preview pesan.'
}

function statusColor(status?: string) {
  if (status === 'open') return 'success'
  if (status === 'takeover') return 'warning'
  return 'light'
}
</script>
