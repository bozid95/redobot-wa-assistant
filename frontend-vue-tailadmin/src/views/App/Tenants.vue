<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Tenants" />

    <div class="space-y-6">
      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-xl font-semibold text-gray-800 dark:text-white/90">Tenant Management</h3>
              <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                {{ tenants.length }} Tenants
              </span>
            </div>
            <p class="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Halaman ini fokus untuk list dan pencarian tenant. Tambah, edit, assignment template, dan delete tenant dilakukan di halaman terpisah agar lebih rapi.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <Button variant="outline" :disabled="loading" @click="loadTenants">
              {{ loading ? 'Refreshing...' : 'Refresh' }}
            </Button>
            <router-link to="/tenants/new">
              <Button>Add Tenant</Button>
            </router-link>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">Total Tenants</p>
            <p class="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ tenants.length }}</p>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">Assigned Template</p>
            <p class="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ assignedTemplateCount }}</p>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">Users</p>
            <p class="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ totalUsersCount }}</p>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">WA Instances</p>
            <p class="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ totalInstancesCount }}</p>
          </div>
        </div>

        <p v-if="flashError" class="mt-4 text-sm text-error-600 dark:text-error-400">{{ flashError }}</p>
      </section>

      <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h4 class="text-lg font-semibold text-gray-800 dark:text-white/90">Tenants Table</h4>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                List tenant dengan action menuju halaman detail dan edit biasa, tanpa form panjang di halaman ini.
              </p>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                v-model="search"
                class="h-11 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90 sm:w-80"
                placeholder="Cari nama tenant, slug, atau template"
              />
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <th class="table-head">Tenant</th>
                <th class="table-head">Template</th>
                <th class="table-head">Users</th>
                <th class="table-head">Instances</th>
                <th class="table-head">Created</th>
                <th class="table-head text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Memuat tenant...
                </td>
              </tr>
              <tr v-else-if="!filteredTenants.length">
                <td colspan="6" class="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Tidak ada tenant yang cocok dengan pencarian saat ini.
                </td>
              </tr>
              <tr
                v-for="item in filteredTenants"
                :key="item.id"
                class="border-t border-gray-200 dark:border-gray-800"
              >
                <td class="table-cell">
                  <div>
                    <p class="font-medium text-gray-800 dark:text-white/90">{{ item.name }}</p>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ item.slug }}</p>
                  </div>
                </td>
                <td class="table-cell">
                  <div>
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {{ item.ragConfig?.assistantTemplate?.name || 'Belum dipilih' }}
                    </p>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{ item.ragConfig?.assistantTemplate?.isSystem ? 'System template' : item.ragConfig?.assistantTemplate ? 'Custom template' : 'No assignment' }}
                    </p>
                  </div>
                </td>
                <td class="table-cell text-sm text-gray-500 dark:text-gray-400">
                  {{ item.users.length }}
                </td>
                <td class="table-cell text-sm text-gray-500 dark:text-gray-400">
                  {{ item.waInstances.length }}
                </td>
                <td class="table-cell text-sm text-gray-500 dark:text-gray-400">
                  {{ formatDate(item.createdAt) }}
                </td>
                <td class="table-cell">
                  <div class="flex justify-end gap-2">
                    <router-link :to="`/tenants/${item.id}/edit`">
                      <Button size="sm" variant="outline">Manage</Button>
                    </router-link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
import { apiFetch } from '@/lib/api'

type AssistantTemplateSummary = {
  id: number
  name: string
  slug: string
  description?: string
  isSystem: boolean
  updatedAt: string
}

type TenantItem = {
  id: number
  name: string
  slug: string
  createdAt: string
  users: Array<{ id: number }>
  waInstances: Array<{ id: number }>
  ragConfig?: {
    assistantTemplateId: number | null
    assistantTemplate: AssistantTemplateSummary | null
  } | null
}

const loading = ref(false)
const flashError = ref('')
const search = ref('')
const tenants = ref<TenantItem[]>([])

const filteredTenants = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return tenants.value

  return tenants.value.filter((item) => {
    return (
      item.name.toLowerCase().includes(keyword) ||
      item.slug.toLowerCase().includes(keyword) ||
      String(item.ragConfig?.assistantTemplate?.name || '')
        .toLowerCase()
        .includes(keyword)
    )
  })
})

const assignedTemplateCount = computed(
  () => tenants.value.filter((item) => item.ragConfig?.assistantTemplateId).length,
)
const totalUsersCount = computed(() =>
  tenants.value.reduce((sum, item) => sum + item.users.length, 0),
)
const totalInstancesCount = computed(() =>
  tenants.value.reduce((sum, item) => sum + item.waInstances.length, 0),
)

function formatDate(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

async function loadTenants() {
  loading.value = true
  flashError.value = ''

  try {
    tenants.value = await apiFetch<TenantItem[]>('/tenants')
  } catch (error) {
    flashError.value = error instanceof Error ? error.message : 'Gagal memuat data tenant'
  } finally {
    loading.value = false
  }
}

onMounted(loadTenants)
</script>

<style scoped>
.table-head {
  padding: 1rem 1.5rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(107 114 128);
}

.table-cell {
  padding: 1rem 1.5rem;
  vertical-align: middle;
}
</style>
