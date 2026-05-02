<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Leads" />

    <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div class="flex items-center justify-between gap-4 border-b border-gray-200 p-6 dark:border-gray-800">
        <div>
          <h3 class="font-medium text-gray-800 dark:text-white/90">Fallback Leads</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Lead yang gagal dijawab bot dan butuh follow up.</p>
        </div>
        <Button variant="outline" :startIcon="RefreshCw" :loading="loading" @click="loadData">Refresh</Button>
      </div>

      <div class="custom-scrollbar max-w-full overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-800">
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Contact</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Reason</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Question</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Status</p>
              </th>
              <th class="px-5 py-3 text-left sm:px-6">
                <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Actions</p>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            <tr v-for="lead in leads" :key="lead.id">
              <td class="px-5 py-4 align-top sm:px-6">
                <p class="min-w-[150px] font-medium text-gray-800 text-theme-sm dark:text-white/90">{{ lead.phone }}</p>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <Badge color="light">{{ lead.reason }}</Badge>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <p class="min-w-[280px] max-w-[420px] text-gray-500 text-theme-sm dark:text-gray-400">{{ lead.question }}</p>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <Badge :color="lead.status === 'open' ? 'error' : 'success'">{{ lead.status }}</Badge>
              </td>
              <td class="px-5 py-4 align-top sm:px-6">
                <div class="flex min-w-[220px] flex-wrap gap-2">
                  <Button v-if="lead.status === 'open'" size="sm" :loading="loading" @click="closeLead(lead.id)">Tutup Lead</Button>
                  <router-link
                    :to="trainingLink(lead)"
                    class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    Lengkapi Latih AI
                  </router-link>
                </div>
              </td>
            </tr>
            <tr v-if="!leads.length">
              <td colspan="5" class="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400 sm:px-6">
                Tidak ada lead fallback.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/composables/useToast'

type Lead = {
  id: number
  phone: string
  question: string
  reason: string
  status: string
}

const leads = ref<Lead[]>([])
const loading = ref(false)
const toast = useToast()

function trainingLink(lead: Lead) {
  return {
    path: '/ai-training',
    query: {
      step: 'knowledge',
      leadId: String(lead.id),
      question: lead.question,
      reason: lead.reason,
      phone: lead.phone,
    },
  }
}

async function loadData() {
  loading.value = true
  try {
    leads.value = await apiFetch<Lead[]>('/leads')
  } catch (error) {
    toast.notify({
      kind: 'error',
      title: 'Gagal memuat leads',
      message: error instanceof Error ? error.message : undefined,
    })
  } finally {
    loading.value = false
  }
}

async function closeLead(id: number) {
  loading.value = true
  try {
    await apiFetch(`/leads/${id}/close`, { method: 'PATCH' })
    toast.notify({ kind: 'success', title: 'Lead berhasil ditutup' })
    await loadData()
  } catch (error) {
    toast.notify({
      kind: 'error',
      title: 'Gagal menutup lead',
      message: error instanceof Error ? error.message : undefined,
    })
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
