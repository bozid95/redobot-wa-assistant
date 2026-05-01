<template>
  <admin-layout>
    <PageBreadcrumb :pageTitle="editingId ? 'Edit User' : 'Add User'" />

    <div class="space-y-6">
      <section class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="border-b border-gray-200 p-5 dark:border-gray-800">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 class="font-semibold text-gray-800 dark:text-white/90">{{ editingId ? 'Edit user' : 'Create user' }}</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ editingId ? 'Perbarui data user, status, role, dan tenant dari halaman ini.' : 'Buat user baru tanpa popup agar alurnya lebih nyaman untuk admin.' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <router-link to="/users">
                <Button size="sm" variant="outline" :startIcon="ArrowLeft">Back to list</Button>
              </router-link>
              <Button size="sm" :startIcon="Save" :disabled="pending || !canSave" @click="saveUser">
                {{ pending ? 'Saving...' : editingId ? 'Update User' : 'Create User' }}
              </Button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
          <div>
            <label class="form-label">Nama</label>
            <input v-model="form.name" class="form-input" placeholder="Nama user" />
          </div>
          <div>
            <label class="form-label">Email</label>
            <input
              v-model="form.email"
              class="form-input"
              placeholder="email@domain.com"
              :disabled="!!editingId"
            />
          </div>
          <div v-if="!editingId">
            <label class="form-label">Password Awal</label>
            <input v-model="form.password" type="password" class="form-input" placeholder="Minimal 8 karakter" />
          </div>
          <div>
            <label class="form-label">Role</label>
            <select v-model="form.role" class="form-input">
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label class="form-label">Tenant</label>
            <select v-model.number="form.tenantId" class="form-input">
              <option :value="0">Pilih tenant</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                {{ tenant.name }}
              </option>
            </select>
          </div>
          <div class="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-800">
            <input v-model="form.isActive" type="checkbox" />
            <span class="text-sm text-gray-700 dark:text-gray-300">User aktif</span>
          </div>
        </div>
      </section>

      <section
        v-if="editingId"
        class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="font-semibold text-gray-800 dark:text-white/90">Reset Password</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Set password baru untuk user ini langsung dari halaman edit.
            </p>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label class="form-label">Password Baru</label>
            <input v-model="passwordForm.password" type="password" class="form-input" placeholder="Minimal 8 karakter" />
          </div>
          <div>
            <label class="form-label">Konfirmasi Password</label>
            <input v-model="passwordForm.confirmPassword" type="password" class="form-input" placeholder="Ulangi password baru" />
          </div>
        </div>

        <div class="mt-5 flex gap-3">
          <Button size="sm" :disabled="resettingPassword || !canResetPassword" @click="resetPassword">
            {{ resettingPassword ? 'Saving...' : 'Save New Password' }}
          </Button>
        </div>
      </section>

      <section
        v-if="editingId"
        class="rounded-2xl border border-error-200 bg-white p-5 dark:border-error-500/30 dark:bg-white/[0.03]"
      >
        <div>
          <h3 class="font-semibold text-error-700 dark:text-error-300">Danger Zone</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hapus user secara permanen. Tidak ada popup, jadi konfirmasi dilakukan langsung di halaman ini.
          </p>
        </div>

        <div class="mt-5 flex items-center gap-3 rounded-xl border border-error-200 px-4 py-3 dark:border-error-500/30">
          <input v-model="confirmDelete" type="checkbox" />
          <span class="text-sm text-gray-700 dark:text-gray-300">Saya yakin ingin menghapus user ini</span>
        </div>

        <div class="mt-5">
          <Button
            size="sm"
            variant="outline"
            className="border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-300"
            :disabled="deleting || !confirmDelete"
            @click="deleteUser"
          >
            {{ deleting ? 'Deleting...' : 'Delete User' }}
          </Button>
        </div>
      </section>

      <p v-if="errorMessage" class="text-sm text-error-600 dark:text-error-400">{{ errorMessage }}</p>
      <p v-if="successMessage" class="text-sm text-success-600 dark:text-success-400">{{ successMessage }}</p>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Save } from 'lucide-vue-next'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import { apiFetch } from '@/lib/api'

type TenantOption = {
  id: number
  name: string
  slug?: string
}

type UserPayload = {
  id: number
  email: string
  name: string
  role: 'admin' | 'user'
  tenantId: number | null
  isActive: boolean
}

const route = useRoute()
const router = useRouter()
const editingId = computed(() => {
  const raw = route.params.id
  return raw ? Number(raw) : null
})

const tenants = ref<TenantOption[]>([])
const pending = ref(false)
const resettingPassword = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = ref({
  name: '',
  email: '',
  password: '',
  role: 'user' as 'admin' | 'user',
  tenantId: 0,
  isActive: true,
})

const passwordForm = ref({
  password: '',
  confirmPassword: '',
})

const canSave = computed(() => {
  if (editingId.value) {
    return !!form.value.name.trim() && !!form.value.tenantId
  }

  return !!form.value.name.trim() && !!form.value.email.trim() && form.value.password.length >= 8 && !!form.value.tenantId
})

const canResetPassword = computed(() => {
  return (
    !!passwordForm.value.password &&
    passwordForm.value.password.length >= 8 &&
    passwordForm.value.password === passwordForm.value.confirmPassword
  )
})

function clearMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

async function loadTenants() {
  tenants.value = await apiFetch<TenantOption[]>('/tenants')
  if (!form.value.tenantId && tenants.value.length) {
    form.value.tenantId = tenants.value[0].id
  }
}

async function loadUser() {
  if (!editingId.value) return

  const user = await apiFetch<UserPayload>(`/users/${editingId.value}`)
  form.value = {
    name: user.name,
    email: user.email,
    password: '',
    role: user.role,
    tenantId: user.tenantId || tenants.value[0]?.id || 0,
    isActive: user.isActive,
  }
}

async function bootstrap() {
  clearMessages()

  try {
    await loadTenants()
    await loadUser()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal memuat data user'
  }
}

async function saveUser() {
  pending.value = true
  clearMessages()

  try {
    if (editingId.value) {
      await apiFetch(`/users/${editingId.value}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.value.name,
          role: form.value.role,
          tenantId: form.value.tenantId,
          isActive: form.value.isActive,
        }),
      })
      successMessage.value = 'User berhasil diperbarui.'
    } else {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(form.value),
      })
      await router.push('/users')
      return
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal menyimpan user'
  } finally {
    pending.value = false
  }
}

async function resetPassword() {
  if (!editingId.value) return

  resettingPassword.value = true
  clearMessages()

  try {
    await apiFetch(`/users/${editingId.value}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: passwordForm.value.password }),
    })
    passwordForm.value = { password: '', confirmPassword: '' }
    successMessage.value = 'Password user berhasil direset.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal reset password'
  } finally {
    resettingPassword.value = false
  }
}

async function deleteUser() {
  if (!editingId.value) return

  deleting.value = true
  clearMessages()

  try {
    await apiFetch(`/users/${editingId.value}`, {
      method: 'DELETE',
    })
    await router.push('/users')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal menghapus user'
  } finally {
    deleting.value = false
  }
}

onMounted(bootstrap)
</script>

<style scoped>
.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(55 65 81);
}

.dark .form-label {
  color: rgb(209 213 219);
}

.form-input {
  width: 100%;
  height: 2.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(209 213 219);
  background: transparent;
  padding: 0 1rem;
  font-size: 0.875rem;
  color: rgb(31 41 55);
  outline: none;
}

.form-input:focus {
  border-color: rgb(70 95 255);
}

.dark .form-input {
  border-color: rgb(55 65 81);
  color: rgb(255 255 255 / 0.9);
}
</style>
