<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Conversation" />

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="space-y-6">
        <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              {{ participantInitial }}
            </div>
            <div class="min-w-0">
              <p class="truncate font-medium text-gray-800 dark:text-white/90">{{ participantName }}</p>
              <p class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{{ conversation?.phone || '-' }}</p>
            </div>
          </div>

          <div class="mt-5 flex items-center gap-2">
            <Badge :color="statusColor(conversation?.status)">{{ conversation?.status || 'unknown' }}</Badge>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ messages.length }} messages</span>
          </div>

          <div class="mt-6 flex flex-col gap-3">
            <Button variant="outline" :startIcon="RefreshCw" :disabled="pending" @click="loadData">Refresh</Button>
            <Button variant="outline" :disabled="pending" @click="setTakeover(true)">Takeover</Button>
            <Button :disabled="pending" @click="setTakeover(false)">Release</Button>
          </div>
        </section>
      </aside>

      <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h3 class="truncate font-medium text-gray-800 dark:text-white/90">{{ participantName }}</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Live conversation workspace</p>
            </div>
            <router-link to="/inbox" class="text-sm text-brand-500">Back</router-link>
          </div>
        </div>

        <div class="max-h-[60vh] space-y-4 overflow-y-auto bg-gray-50 px-4 py-6 dark:bg-gray-900/40 sm:px-6">
          <div
            v-for="message in messages"
            :key="message.id"
            class="flex"
            :class="messageRowClass(message.role)"
          >
            <div class="max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-theme-xs sm:max-w-[75%]" :class="bubbleClass(message.role)">
              <p class="mb-1 text-xs font-medium opacity-70">{{ metaLabel(message.role) }}</p>
              <p class="whitespace-pre-wrap leading-6">{{ message.message }}</p>
            </div>
          </div>

          <div v-if="!messages.length" class="flex min-h-[280px] items-center justify-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">Belum ada pesan.</p>
          </div>
        </div>

        <div class="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              v-model="reply"
              rows="3"
              class="min-h-[96px] w-full rounded-xl border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              placeholder="Type a message"
            />
            <Button className="sm:min-w-[120px]" :disabled="pending || !reply.trim()" @click="submitReply">
              {{ pending ? 'Sending...' : 'Send' }}
            </Button>
          </div>
        </div>
      </section>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { RefreshCw } from 'lucide-vue-next'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { apiFetch } from '@/lib/api'

type Conversation = {
  id: number
  customerName?: string
  customer_name?: string
  phone?: string
  status?: string
}

type Message = {
  id: number
  role: string
  message: string
}

const route = useRoute()
const id = String(route.params.id)
const conversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const reply = ref('')
const pending = ref(false)

async function loadData() {
  const [detail, messageList] = await Promise.all([
    apiFetch<Conversation>(`/conversations/${id}`),
    apiFetch<Message[]>(`/conversations/${id}/messages`),
  ])
  conversation.value = detail
  messages.value = messageList
}

onMounted(loadData)

const participantName = computed(() =>
  conversation.value?.customerName || conversation.value?.customer_name || conversation.value?.phone || 'Unknown contact',
)

const participantInitial = computed(() => participantName.value.trim().charAt(0).toUpperCase() || '?')

async function submitReply() {
  if (!reply.value.trim()) return
  pending.value = true
  try {
    await apiFetch(`/conversations/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply: reply.value }),
    })
    reply.value = ''
    await loadData()
  } finally {
    pending.value = false
  }
}

async function setTakeover(enabled: boolean) {
  pending.value = true
  try {
    await apiFetch(`/conversations/${id}/${enabled ? 'takeover' : 'release'}`, {
      method: 'POST',
    })
    await loadData()
  } finally {
    pending.value = false
  }
}

function bubbleClass(role: string) {
  if (role === 'user') return 'border-gray-200 bg-white text-gray-800 dark:border-gray-800 dark:bg-gray-800 dark:text-white/90'
  if (role === 'assistant') return 'border-brand-200 bg-brand-500 text-white dark:border-brand-500 dark:bg-brand-500'
  return 'border-warning-200 bg-warning-50 text-gray-800 dark:border-warning-800 dark:bg-warning-500/10 dark:text-white/90'
}

function messageRowClass(role: string) {
  if (role === 'user') return 'justify-start'
  return 'justify-end'
}

function metaLabel(role: string) {
  if (role === 'user') return 'Customer'
  if (role === 'assistant') return 'AI Agent'
  if (role === 'admin') return 'Operator'
  return 'System'
}

function statusColor(status?: string) {
  if (status === 'open') return 'success'
  if (status === 'takeover') return 'warning'
  return 'light'
}
</script>
