<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="AI Templates" />

    <div class="space-y-6">
      <section class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-xl font-semibold text-gray-800 dark:text-white/90">Template Library</h3>
              <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                Global Assistant Design
              </span>
            </div>
            <p class="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Kelola template AI assistant di sini, lalu assign template yang tepat dari halaman tenant. Editor template tetap memakai konfigurasi lengkap seperti profile, intents, fields,
              actions, routing, preview, dan advanced retrieval.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <Button @click="goToNewTemplate">Add Template</Button>
            <Button variant="outline" :disabled="loading" @click="loadTemplates">
              {{ loading ? 'Refreshing...' : 'Refresh' }}
            </Button>
          </div>
        </div>

        <p v-if="message" :class="['mt-4 text-sm', messageClass]">{{ message }}</p>
      </section>

      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p class="text-xs uppercase tracking-wide text-gray-500">Total Templates</p>
          <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ templates.length }}</p>
        </div>
        <div class="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p class="text-xs uppercase tracking-wide text-gray-500">System Templates</p>
          <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ systemTemplateCount }}</p>
        </div>
        <div class="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p class="text-xs uppercase tracking-wide text-gray-500">Custom Templates</p>
          <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ customTemplateCount }}</p>
        </div>
        <div class="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p class="text-xs uppercase tracking-wide text-gray-500">Average Intents</p>
          <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ averageIntentCount }}</p>
        </div>
      </section>

      <section class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Template List</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Setiap template di bawah ini bisa diedit lalu dipakai banyak tenant sekaligus.
            </p>
          </div>
        </div>

        <div class="mt-6 space-y-4">
          <div
            v-for="template in templates"
            :key="template.id"
            class="rounded-3xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900/70"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-3">
                  <h4 class="text-base font-semibold text-gray-800 dark:text-white/90">{{ template.name }}</h4>
                  <span
                    :class="[
                      'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                      template.isSystem
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                        : 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300',
                    ]"
                  >
                    {{ template.isSystem ? 'System' : 'Custom' }}
                  </span>
                </div>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ template.description || 'Tidak ada deskripsi template.' }}</p>
                <div class="mt-4 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span class="rounded-full bg-white px-3 py-1 dark:bg-gray-950/60">Slug: {{ template.slug }}</span>
                  <span class="rounded-full bg-white px-3 py-1 dark:bg-gray-950/60">Intents: {{ template.assistantFlow.intents.length }}</span>
                  <span class="rounded-full bg-white px-3 py-1 dark:bg-gray-950/60">Fields: {{ template.assistantFlow.fields.length }}</span>
                  <span class="rounded-full bg-white px-3 py-1 dark:bg-gray-950/60">Actions: {{ template.assistantFlow.actions.length }}</span>
                  <span class="rounded-full bg-white px-3 py-1 dark:bg-gray-950/60">Updated: {{ formatUpdatedAt(template.updatedAt) }}</span>
                </div>
              </div>

              <div class="flex flex-wrap gap-3 xl:justify-end">
                <Button size="sm" @click="editTemplate(template.id)">Edit Template</Button>
              </div>
            </div>
          </div>

          <p v-if="!templates.length && !loading" class="text-sm text-gray-500 dark:text-gray-400">
            Belum ada template.
          </p>
        </div>
      </section>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import { apiFetch } from '@/lib/api'

type ActionType =
  | 'answer_from_knowledge'
  | 'collect_fields'
  | 'handoff_admin'
  | 'send_payment_info'
  | 'send_custom_message'

type FieldType = 'text' | 'phone' | 'date' | 'select' | 'textarea'

type AssistantFlowDraft = {
  profile: {
    assistantName: string
    businessContext: string
    greetingMessage: string
    clarifyMessage: string
    fallbackMessage: string
    thanksMessage: string
    menuEnabled: boolean
    menuItems: Array<{
      id: string
      label: string
      prompt: string
    }>
  }
  intents: Array<{
    id: string
    key: string
    label: string
    keywords: string[]
    searchHints: string[]
    defaultAction: string | null
  }>
  fields: Array<{
    id: string
    key: string
    label: string
    type: FieldType
    required: boolean
    placeholder: string
    helpText: string
    options?: string[]
  }>
  actions: Array<{
    id: string
    key: string
    type: ActionType
    label: string
    messageTemplate?: string
    fieldKeys?: string[]
  }>
  routingRules: Array<{
    id: string
    intentKey: string
    actionKey: string
    ifMissingFields?: string[]
    ifConfidenceBelow?: number | null
  }>
  advanced: {
    systemPrompt: string
    paymentPrompt: string
    scoreThreshold: number
    topK: number
    maxChunks: number
    chunkTargetTokens: number
  }
}

type AssistantTemplateItem = {
  id: number
  name: string
  slug: string
  description: string
  isSystem: boolean
  updatedAt: string
  assistantFlow: AssistantFlowDraft
}

const router = useRouter()
const templates = ref<AssistantTemplateItem[]>([])
const loading = ref(false)
const message = ref('')
const messageKind = ref<'success' | 'error' | 'info'>('info')

const systemTemplateCount = computed(() => templates.value.filter((item) => item.isSystem).length)
const customTemplateCount = computed(() => templates.value.filter((item) => !item.isSystem).length)
const averageIntentCount = computed(() => {
  if (!templates.value.length) return '0'
  const total = templates.value.reduce((sum, item) => sum + item.assistantFlow.intents.length, 0)
  return (total / templates.value.length).toFixed(1)
})

const messageClass = computed(() => {
  if (messageKind.value === 'success') return 'text-success-600 dark:text-success-400'
  if (messageKind.value === 'error') return 'text-error-600 dark:text-error-400'
  return 'text-brand-700 dark:text-brand-300'
})

function formatUpdatedAt(value: string | null) {
  if (!value) return 'Belum pernah disimpan'
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function setMessage(kind: 'success' | 'error' | 'info', value: string) {
  messageKind.value = kind
  message.value = value
}

async function loadTemplates() {
  loading.value = true
  try {
    templates.value = await apiFetch<AssistantTemplateItem[]>('/rag-config/templates')
    setMessage('info', 'Library template berhasil dimuat.')
  } catch (error) {
    setMessage('error', error instanceof Error ? error.message : 'Gagal memuat template')
  } finally {
    loading.value = false
  }
}

function goToNewTemplate() {
  router.push('/ai-settings/rag-config/new')
}

function editTemplate(id: number) {
  router.push(`/ai-settings/rag-config/${id}/edit`)
}

onMounted(loadTemplates)
</script>
