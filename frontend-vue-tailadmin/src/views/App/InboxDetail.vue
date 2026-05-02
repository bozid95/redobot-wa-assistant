<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Conversation" />

    <div class="conversation-shell grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside class="conversation-side space-y-6 xl:overflow-y-auto">
        <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="flex items-start gap-4">
            <div class="flex size-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              {{ participantInitial }}
            </div>
            <div class="min-w-0">
              <p class="truncate text-base font-semibold text-gray-800 dark:text-white/90">{{ participantName }}</p>
              <p class="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{{ conversation?.phone || '-' }}</p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <Badge :color="statusColor(conversation?.status)">{{ statusLabel(conversation?.status) }}</Badge>
                <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  {{ messages.length }} pesan
                </span>
              </div>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-2 gap-3">
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Terakhir</p>
              <p class="mt-2 text-sm font-medium text-gray-800 dark:text-white/90">{{ lastMessageTime }}</p>
            </div>
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Mode</p>
              <p class="mt-2 text-sm font-medium text-gray-800 dark:text-white/90">{{ conversation?.status === 'takeover' ? 'Operator' : 'AI aktif' }}</p>
            </div>
          </div>

          <div class="mt-6 flex flex-col gap-3">
            <Button variant="outline" :startIcon="RefreshCw" :loading="loading" :disabled="pending" @click="loadData">
              {{ loading ? 'Loading...' : 'Refresh' }}
            </Button>
            <Button v-if="conversation?.status !== 'takeover'" variant="outline" :loading="pending" @click="setTakeover(true)">
              Ambil Alih Chat
            </Button>
            <Button v-else :loading="pending" @click="setTakeover(false)">
              Kembalikan ke AI
            </Button>
          </div>
        </section>

        <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 class="font-semibold text-gray-800 dark:text-white/90">Ringkasan Pesan</h3>
          <div class="mt-4 space-y-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <span class="text-gray-500 dark:text-gray-400">Pelanggan</span>
              <span class="font-medium text-gray-800 dark:text-white/90">{{ roleCount.user }}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-gray-500 dark:text-gray-400">AI</span>
              <span class="font-medium text-gray-800 dark:text-white/90">{{ roleCount.assistant }}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-gray-500 dark:text-gray-400">Operator</span>
              <span class="font-medium text-gray-800 dark:text-white/90">{{ roleCount.admin }}</span>
            </div>
          </div>
        </section>
      </aside>

      <section class="conversation-panel flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:px-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <h3 class="truncate font-semibold text-gray-800 dark:text-white/90">{{ participantName }}</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ conversation?.status === 'takeover' ? 'Operator sedang mengambil alih percakapan.' : 'AI aktif membalas berdasarkan konfigurasi tenant.' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-3">
              <router-link to="/inbox">
                <Button size="sm" variant="outline" :startIcon="ArrowLeft">Kembali</Button>
              </router-link>
              <Button size="sm" variant="outline" :startIcon="RefreshCw" :loading="loading" :disabled="pending" @click="loadData">Refresh</Button>
            </div>
          </div>
        </div>

        <div ref="chatScrollEl" class="chat-scroll flex-1 space-y-4 overflow-y-auto bg-gray-50 px-4 py-6 dark:bg-gray-900/40 sm:px-6">
          <div
            v-for="message in messages"
            :key="message.id"
            class="flex"
            :class="messageRowClass(message.role)"
          >
            <div class="message-bubble" :class="bubbleClass(message.role)">
              <div class="mb-1 flex items-center justify-between gap-4">
                <p class="text-xs font-semibold opacity-75">{{ metaLabel(message.role) }}</p>
                <p class="text-[11px] opacity-60">{{ messageTime(message) }}</p>
              </div>
              <p class="whitespace-pre-wrap leading-6">{{ message.message }}</p>
            </div>
          </div>

          <div v-if="!messages.length" class="flex min-h-[280px] items-center justify-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">Belum ada pesan.</p>
          </div>
        </div>

        <div class="border-t border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-950/40 sm:px-6">
          <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ conversation?.status === 'takeover' ? 'Balasan operator akan dikirim ke WhatsApp pelanggan.' : 'Mengirim manual akan otomatis mengambil alih chat.' }}
            </p>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ reply.length }} karakter</span>
          </div>
          <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
            <textarea
              v-model="reply"
              rows="3"
              class="composer-input"
              placeholder="Tulis balasan untuk pelanggan..."
              @keydown.ctrl.enter.prevent="submitReply"
            />
            <Button className="lg:min-w-[140px]" :loading="pending" :disabled="!reply.trim()" @click="submitReply">
              {{ pending ? 'Mengirim...' : 'Kirim' }}
            </Button>
          </div>
        </div>
      </section>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, RefreshCw } from 'lucide-vue-next'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/composables/useToast'

type Conversation = {
  id: number
  customerName?: string
  customer_name?: string
  phone?: string
  status?: string
  lastMessageAt?: string
  last_message_at?: string
}

type Message = {
  id: number
  role: string
  message: string
  createdAt?: string
  created_at?: string
}

const route = useRoute()
const id = String(route.params.id)
const conversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const reply = ref('')
const pending = ref(false)
const loading = ref(false)
const chatScrollEl = ref<HTMLElement | null>(null)
const toast = useToast()

async function scrollToLatestMessage() {
  await nextTick()
  const el = chatScrollEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

async function loadData() {
  loading.value = true
  try {
    const [detail, messageList] = await Promise.all([
      apiFetch<Conversation>(`/conversations/${id}`),
      apiFetch<Message[]>(`/conversations/${id}/messages`),
    ])
    conversation.value = detail
    messages.value = messageList
    await scrollToLatestMessage()
  } catch (error) {
    toast.notify({
      kind: 'error',
      title: 'Gagal memuat conversation',
      message: error instanceof Error ? error.message : undefined,
    })
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

watch(
  () => messages.value.length,
  () => {
    void scrollToLatestMessage()
  },
)

const participantName = computed(() =>
  conversation.value?.customerName || conversation.value?.customer_name || conversation.value?.phone || 'Unknown contact',
)

const participantInitial = computed(() => participantName.value.trim().charAt(0).toUpperCase() || '?')

const roleCount = computed(() => ({
  user: messages.value.filter((message) => message.role === 'user').length,
  assistant: messages.value.filter((message) => message.role === 'assistant').length,
  admin: messages.value.filter((message) => message.role === 'admin').length,
}))

const lastMessageTime = computed(() => {
  const last = messages.value[messages.value.length - 1]
  const value = last?.createdAt || last?.created_at || conversation.value?.lastMessageAt || conversation.value?.last_message_at
  return formatDateTime(value)
})

async function submitReply() {
  if (!reply.value.trim()) return
  pending.value = true
  try {
    await apiFetch(`/conversations/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply: reply.value }),
    })
    reply.value = ''
    toast.notify({ kind: 'success', title: 'Balasan berhasil dikirim' })
    await loadData()
  } catch (error) {
    toast.notify({
      kind: 'error',
      title: 'Gagal mengirim balasan',
      message: error instanceof Error ? error.message : undefined,
    })
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
    toast.notify({ kind: 'success', title: enabled ? 'Chat berhasil diambil alih' : 'Chat dikembalikan ke AI' })
    await loadData()
  } catch (error) {
    toast.notify({
      kind: 'error',
      title: enabled ? 'Gagal mengambil alih chat' : 'Gagal mengembalikan chat ke AI',
      message: error instanceof Error ? error.message : undefined,
    })
  } finally {
    pending.value = false
  }
}

function bubbleClass(role: string) {
  if (role === 'user') return 'bg-white text-gray-800 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-white/90 dark:ring-gray-700'
  if (role === 'assistant') return 'bg-brand-500 text-white'
  if (role === 'admin') return 'bg-success-50 text-gray-800 ring-1 ring-success-200 dark:bg-success-500/10 dark:text-white/90 dark:ring-success-800'
  return 'bg-warning-50 text-gray-800 ring-1 ring-warning-200 dark:bg-warning-500/10 dark:text-white/90 dark:ring-warning-800'
}

function messageRowClass(role: string) {
  if (role === 'user') return 'justify-start'
  return 'justify-end'
}

function metaLabel(role: string) {
  if (role === 'user') return 'Pelanggan'
  if (role === 'assistant') return 'AI Agent'
  if (role === 'admin') return 'Operator'
  return 'Sistem'
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

function formatDateTime(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function messageTime(message: Message) {
  return formatDateTime(message.createdAt || message.created_at)
}
</script>

<style scoped>
.conversation-shell {
  min-height: calc(100vh - 150px);
}

.chat-scroll {
  min-height: 420px;
}

@media (min-width: 1280px) {
  .conversation-panel {
    height: calc(100vh - 150px);
    min-height: 620px;
  }

  .conversation-side {
    max-height: calc(100vh - 150px);
  }

  .chat-scroll {
    min-height: 0;
  }
}

.message-bubble {
  max-width: 88%;
  border-radius: 1rem;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  box-shadow: 0 1px 2px rgb(16 24 40 / 0.08);
}

@media (min-width: 640px) {
  .message-bubble {
    max-width: 74%;
  }
}

.composer-input {
  min-height: 104px;
  width: 100%;
  resize: vertical;
  border-radius: 1rem;
  border: 1px solid rgb(209 213 219);
  background: transparent;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  line-height: 1.625;
  color: rgb(31 41 55);
  outline: none;
}

.composer-input:focus {
  border-color: rgb(70 95 255);
  box-shadow: 0 0 0 3px rgb(70 95 255 / 0.1);
}

.dark .composer-input {
  border-color: rgb(55 65 81);
  background: rgb(17 24 39);
  color: rgb(243 244 246);
}
</style>
