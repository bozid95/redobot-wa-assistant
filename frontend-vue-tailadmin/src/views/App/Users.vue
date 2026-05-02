<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Users" />

    <div class="space-y-6">
      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-xl font-semibold text-gray-800 dark:text-white/90">User Management</h3>
              <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                {{ users.length }} Users
              </span>
            </div>
            <p class="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Halaman ini fokus untuk list dan pencarian user. Tambah atau edit user dilakukan di halaman terpisah agar lebih rapi.
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <Button variant="outline" :loading="loading" @click="bootstrap">
              {{ loading ? 'Refreshing...' : 'Refresh' }}
            </Button>
            <router-link to="/users/new">
              <Button>Add User</Button>
            </router-link>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">Total Users</p>
            <p class="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ users.length }}</p>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">Active</p>
            <p class="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ activeUsersCount }}</p>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">Platform Admin</p>
            <p class="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ adminUsersCount }}</p>
          </div>
        </div>

        <p v-if="flashError" class="mt-4 text-sm text-error-600 dark:text-error-400">{{ flashError }}</p>
      </section>

      <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h4 class="text-lg font-semibold text-gray-800 dark:text-white/90">Users Table</h4>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                List user per tenant dengan action menuju halaman edit biasa, tanpa popup.
              </p>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                v-model="search"
                class="h-11 w-full rounded-xl border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90 sm:w-72"
                placeholder="Cari nama atau email"
              />
              <select
                v-model.number="selectedTenantId"
                class="h-11 rounded-xl border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              >
                <option :value="0">Semua tenant</option>
                <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                  {{ tenant.name }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <th class="table-head">User</th>
                <th class="table-head">Role</th>
                <th class="table-head">Tenant</th>
                <th class="table-head">Status</th>
                <th class="table-head">Created</th>
                <th class="table-head text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Memuat user...
                </td>
              </tr>
              <tr v-else-if="!filteredUsers.length">
                <td colspan="6" class="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Tidak ada user yang cocok dengan filter saat ini.
                </td>
              </tr>
              <tr
                v-for="item in filteredUsers"
                :key="item.id"
                class="border-t border-gray-200 dark:border-gray-800"
              >
                <td class="table-cell">
                  <div>
                    <p class="font-medium text-gray-800 dark:text-white/90">{{ item.name }}</p>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ item.email }}</p>
                  </div>
                </td>
                <td class="table-cell">
                  <span
                    :class="[
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
                      item.role === 'platform_admin'
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                    ]"
                  >
                    {{ item.role }}
                  </span>
                </td>
                <td class="table-cell">
                  <span class="text-sm text-gray-700 dark:text-gray-200">{{ item.tenant?.name || '-' }}</span>
                </td>
                <td class="table-cell">
                  <span
                    :class="[
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                      item.isActive
                        ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300'
                        : 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300',
                    ]"
                  >
                    {{ item.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="table-cell text-sm text-gray-500 dark:text-gray-400">
                  {{ formatDate(item.createdAt) }}
                </td>
                <td class="table-cell">
                  <div class="flex justify-end gap-2">
                    <router-link :to="`/users/${item.id}/edit`">
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

type TenantOption = {
  id: number
  name: string
  slug?: string
}

type UserItem = {
  id: number
  email: string
  name: string
  role: UserRole
  tenantId: number | null
  isActive: boolean
  createdAt: string
  tenant?: TenantOption | null
}

const loading = ref(false)
const flashError = ref('')
const tenants = ref<TenantOption[]>([])
const users = ref<UserItem[]>([])
const search = ref('')
const selectedTenantId = ref(0)

const filteredUsers = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return users.value.filter((item) => {
    const matchTenant = selectedTenantId.value === 0 || item.tenantId === selectedTenantId.value
    const matchKeyword =
      !keyword ||
      item.name.toLowerCase().includes(keyword) ||
      item.email.toLowerCase().includes(keyword)

    return matchTenant && matchKeyword
  })
})

const activeUsersCount = computed(() => users.value.filter((item) => item.isActive).length)
type UserRole = 'platform_admin' | 'tenant_admin' | 'tenant_staff'

const adminUsersCount = computed(() => users.value.filter((item) => item.role === 'platform_admin').length)

function formatDate(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

async function bootstrap() {
  loading.value = true
  flashError.value = ''

  try {
    const [tenantData, userData] = await Promise.all([
      apiFetch<TenantOption[]>('/tenants'),
      apiFetch<UserItem[]>('/users'),
    ])

    tenants.value = tenantData
    users.value = userData
  } catch (error) {
    flashError.value = error instanceof Error ? error.message : 'Gagal memuat data user'
  } finally {
    loading.value = false
  }
}

onMounted(bootstrap)
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
