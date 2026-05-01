<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Tenants" />

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Tenant Baru</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tenant baru otomatis dibuatkan instance WhatsApp sendiri.
        </p>

        <div class="mt-6 space-y-4">
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Tenant</label>
            <input
              v-model="newTenantName"
              class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              placeholder="Contoh: Cabang Bandung"
            />
          </div>
        </div>

        <p v-if="formMessage" class="mt-4 text-sm text-success-600 dark:text-success-400">{{ formMessage }}</p>
        <p v-if="formError" class="mt-4 text-sm text-error-600 dark:text-error-400">{{ formError }}</p>

        <div class="mt-6 flex gap-3">
          <Button :disabled="saving" @click="createTenant">
            {{ saving ? 'Menyimpan...' : 'Tambah Tenant' }}
          </Button>
          <Button variant="outline" :disabled="loading" @click="loadTenants">Refresh</Button>
        </div>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Daftar Tenant</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ tenants.length }} tenant aktif terdaftar.</p>
          </div>
        </div>

        <div class="mt-6 space-y-4">
          <div
            v-for="tenant in tenants"
            :key="tenant.id"
            class="rounded-2xl border border-gray-200 p-5 dark:border-gray-800"
          >
            <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_200px_auto] xl:items-center">
              <div>
                <label class="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">Nama Tenant</label>
                <input
                  v-model="tenant.draftName"
                  class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
                />
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">Slug</label>
                <div class="h-11 rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm leading-[44px] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                  {{ tenant.slug }}
                </div>
              </div>
              <div class="flex gap-3 xl:justify-end">
                <Button size="sm" :disabled="savingTenantId === tenant.id" @click="updateTenant(tenant.id)">
                  {{ savingTenantId === tenant.id ? 'Menyimpan...' : 'Simpan' }}
                </Button>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span class="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                Users: {{ tenant.users.length }}
              </span>
              <span class="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                Instances: {{ tenant.waInstances.length }}
              </span>
            </div>
          </div>

          <p v-if="!tenants.length && !loading" class="text-sm text-gray-500 dark:text-gray-400">
            Belum ada tenant.
          </p>
        </div>
      </section>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import { apiFetch } from '@/lib/api'

type TenantItem = {
  id: number
  name: string
  slug: string
  users: Array<{ id: number }>
  waInstances: Array<{ id: number }>
  draftName: string
}

const tenants = ref<TenantItem[]>([])
const loading = ref(false)
const saving = ref(false)
const savingTenantId = ref<number | null>(null)
const newTenantName = ref('')
const formMessage = ref('')
const formError = ref('')

async function loadTenants() {
  loading.value = true
  try {
    const data = await apiFetch<Array<Omit<TenantItem, 'draftName'>>>('/tenants')
    tenants.value = data.map((tenant) => ({
      ...tenant,
      draftName: tenant.name,
    }))
  } finally {
    loading.value = false
  }
}

async function createTenant() {
  saving.value = true
  formMessage.value = ''
  formError.value = ''

  try {
    await apiFetch('/tenants', {
      method: 'POST',
      body: JSON.stringify({ name: newTenantName.value }),
    })
    formMessage.value = 'Tenant berhasil dibuat.'
    newTenantName.value = ''
    await loadTenants()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Gagal membuat tenant'
  } finally {
    saving.value = false
  }
}

async function updateTenant(id: number) {
  const tenant = tenants.value.find((item) => item.id === id)
  if (!tenant) return

  savingTenantId.value = id
  formMessage.value = ''
  formError.value = ''

  try {
    await apiFetch(`/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: tenant.draftName }),
    })
    formMessage.value = 'Tenant berhasil diperbarui.'
    await loadTenants()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Gagal memperbarui tenant'
  } finally {
    savingTenantId.value = null
  }
}

onMounted(loadTenants)
</script>
