<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Users" />

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Tambah User</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Admin bisa membuat dan mengelola user dalam aplikasi.
        </p>

        <div class="mt-6 space-y-4">
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Nama</label>
            <input
              v-model="createForm.name"
              class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              placeholder="Nama user"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              v-model="createForm.email"
              class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              placeholder="email@domain.com"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input
              v-model="createForm.password"
              type="password"
              class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              placeholder="Password awal"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <select
              v-model="createForm.role"
              class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Tenant</label>
            <select
              v-model.number="createForm.tenantId"
              class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
            >
              <option :value="0">Pilih tenant</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                {{ tenant.name }}
              </option>
            </select>
          </div>
          <label class="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="createForm.isActive" type="checkbox" />
            User aktif
          </label>
        </div>

        <p v-if="formMessage" class="mt-4 text-sm text-success-600 dark:text-success-400">{{ formMessage }}</p>
        <p v-if="formError" class="mt-4 text-sm text-error-600 dark:text-error-400">{{ formError }}</p>

        <div class="mt-6 flex gap-3">
          <Button :disabled="creating" @click="createUser">
            {{ creating ? 'Menyimpan...' : 'Tambah User' }}
          </Button>
          <Button variant="outline" :disabled="loading" @click="bootstrap">Refresh</Button>
        </div>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Daftar User</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ users.length }} user terdaftar.</p>
          </div>
        </div>

        <div class="mt-6 space-y-4">
          <div
            v-for="item in users"
            :key="item.id"
            class="rounded-2xl border border-gray-200 p-5 dark:border-gray-800"
          >
            <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <label class="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">Nama</label>
                <input
                  v-model="item.draft.name"
                  class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
                />
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">Email</label>
                <div class="flex h-11 items-center rounded-lg border border-gray-300 bg-gray-50 px-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                  {{ item.email }}
                </div>
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">Role</label>
                <select
                  v-model="item.draft.role"
                  class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">Tenant</label>
                <select
                  v-model.number="item.draft.tenantId"
                  class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
                >
                  <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                    {{ tenant.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-3">
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input v-model="item.draft.isActive" type="checkbox" />
                Aktif
              </label>
              <Button size="sm" :disabled="savingUserId === item.id" @click="updateUser(item.id)">
                {{ savingUserId === item.id ? 'Menyimpan...' : 'Simpan' }}
              </Button>
              <Button size="sm" variant="outline" :disabled="resettingUserId === item.id" @click="resetPassword(item.id)">
                {{ resettingUserId === item.id ? 'Reset...' : 'Reset Password' }}
              </Button>
            </div>
          </div>

          <p v-if="!users.length && !loading" class="text-sm text-gray-500 dark:text-gray-400">
            Belum ada user.
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

type TenantOption = {
  id: number
  name: string
}

type UserItem = {
  id: number
  email: string
  name: string
  role: 'admin' | 'user'
  tenantId: number | null
  isActive: boolean
  tenant?: TenantOption | null
  draft: {
    name: string
    role: 'admin' | 'user'
    tenantId: number
    isActive: boolean
  }
}

const loading = ref(false)
const creating = ref(false)
const savingUserId = ref<number | null>(null)
const resettingUserId = ref<number | null>(null)
const tenants = ref<TenantOption[]>([])
const users = ref<UserItem[]>([])
const formMessage = ref('')
const formError = ref('')
const createForm = ref({
  name: '',
  email: '',
  password: '',
  role: 'user' as UserItem['role'],
  tenantId: 0,
  isActive: true,
})

function hydrateUsers(data: Array<Omit<UserItem, 'draft'>>) {
  users.value = data.map((item) => ({
    ...item,
    draft: {
      name: item.name,
      role: item.role,
      tenantId: item.tenantId || 0,
      isActive: item.isActive,
    },
  }))
}

async function bootstrap() {
  loading.value = true
  try {
    const [tenantData, userData] = await Promise.all([
      apiFetch<TenantOption[]>('/tenants'),
      apiFetch<Array<Omit<UserItem, 'draft'>>>('/users'),
    ])
    tenants.value = tenantData
    hydrateUsers(userData)
  } finally {
    loading.value = false
  }
}

async function createUser() {
  creating.value = true
  formMessage.value = ''
  formError.value = ''

  try {
    await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(createForm.value),
    })
    formMessage.value = 'User berhasil dibuat.'
    createForm.value = {
      name: '',
      email: '',
      password: '',
      role: 'user',
      tenantId: tenants.value[0]?.id || 0,
      isActive: true,
    }
    await bootstrap()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Gagal membuat user'
  } finally {
    creating.value = false
  }
}

async function updateUser(id: number) {
  const user = users.value.find((item) => item.id === id)
  if (!user) return

  savingUserId.value = id
  formMessage.value = ''
  formError.value = ''

  try {
    await apiFetch(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(user.draft),
    })
    formMessage.value = 'User berhasil diperbarui.'
    await bootstrap()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Gagal memperbarui user'
  } finally {
    savingUserId.value = null
  }
}

async function resetPassword(id: number) {
  const password = window.prompt('Masukkan password baru (minimal 8 karakter):')
  if (!password) return

  resettingUserId.value = id
  formMessage.value = ''
  formError.value = ''

  try {
    await apiFetch(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    formMessage.value = 'Password user berhasil direset.'
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Gagal reset password'
  } finally {
    resettingUserId.value = null
  }
}

onMounted(bootstrap)
</script>
