<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Knowledge" />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p class="text-sm text-gray-500 dark:text-gray-400">Total articles</p>
        <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ articles.length }}</p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p class="text-sm text-gray-500 dark:text-gray-400">Search result</p>
        <p class="mt-3 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ filteredArticles.length }}</p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p class="text-sm text-gray-500 dark:text-gray-400">Status</p>
        <p class="mt-3 text-lg font-semibold text-gray-800 dark:text-white/90">Ready</p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p class="text-sm text-gray-500 dark:text-gray-400">Action</p>
        <div class="mt-3">
          <router-link to="/knowledge/new">
            <Button size="sm" :startIcon="Plus">Add New</Button>
          </router-link>
        </div>
      </div>
    </div>

    <section class="mt-6 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div class="border-b border-gray-200 p-5 dark:border-gray-800">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 class="font-semibold text-gray-800 dark:text-white/90">Knowledge list</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Kelola artikel knowledge untuk bot dan operator.</p>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row">
            <div class="relative min-w-[260px]">
              <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
              <input
                v-model="search"
                type="text"
                placeholder="Cari judul atau isi"
                class="h-11 w-full rounded-lg border border-gray-300 bg-transparent pr-4 pl-10 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>
            <Button size="sm" variant="outline" :startIcon="RefreshCw" :disabled="pending" @click="reindexAll">Reindex</Button>
          </div>
        </div>
      </div>

      <div class="custom-scrollbar max-w-full overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-800">
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Title</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Status</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Updated</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Actions</p>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            <tr v-for="article in filteredArticles" :key="article.id">
              <td class="px-5 py-4 align-top sm:px-6">
                <div class="min-w-[280px] max-w-[520px]">
                  <p class="font-medium text-gray-800 text-theme-sm dark:text-white/90">{{ article.title }}</p>
                  <p class="mt-1 line-clamp-2 text-gray-500 text-theme-sm dark:text-gray-400">{{ articleExcerpt(article.content) }}</p>
                </div>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <Badge color="light">{{ article.status }}</Badge>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <p class="min-w-[170px] text-gray-500 text-theme-sm dark:text-gray-400">{{ updatedLabel(article) }}</p>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <div class="flex min-w-[170px] flex-wrap gap-2">
                  <router-link :to="`/knowledge/${article.id}/edit`">
                    <Button size="sm" variant="outline">Edit</Button>
                  </router-link>
                  <Button size="sm" variant="outline" :disabled="pending" @click="removeArticle(article.id)">Delete</Button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredArticles.length">
              <td colspan="4" class="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400 sm:px-6">
                Tidak ada artikel yang cocok.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, RefreshCw, Search } from 'lucide-vue-next'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { apiFetch } from '@/lib/api'

type KnowledgeArticle = {
  id: number
  title: string
  content: string
  status: string
  updatedAt?: string
  updated_at?: string
}

const articles = ref<KnowledgeArticle[]>([])
const search = ref('')
const pending = ref(false)

async function loadData() {
  articles.value = await apiFetch<KnowledgeArticle[]>('/knowledge')
}

async function removeArticle(id: number) {
  const confirmed = window.confirm('Hapus artikel ini?')
  if (!confirmed) return

  pending.value = true
  try {
    await apiFetch(`/knowledge/${id}`, { method: 'DELETE' })
    await loadData()
  } finally {
    pending.value = false
  }
}

async function reindexAll() {
  pending.value = true
  try {
    await apiFetch('/knowledge/reindex', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    await loadData()
  } finally {
    pending.value = false
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, ' ')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function articleExcerpt(content: string) {
  const plain = stripHtml(content)
  return plain.length > 140 ? `${plain.slice(0, 140)}...` : plain || 'Tanpa isi'
}

function updatedLabel(article: KnowledgeArticle) {
  const value = article.updatedAt || article.updated_at
  if (!value) return 'No update info'
  return `Updated ${new Date(value).toLocaleString()}`
}

const filteredArticles = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return articles.value

  return articles.value.filter((article) => {
    const haystack = `${article.title} ${stripHtml(article.content)}`.toLowerCase()
    return haystack.includes(keyword)
  })
})

onMounted(loadData)
</script>
