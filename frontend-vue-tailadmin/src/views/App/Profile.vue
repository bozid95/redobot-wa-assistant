<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Profile" />

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Informasi Profil</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Update nama tampilan akun Anda.
            </p>
          </div>
          <span class="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {{ auth.user.value?.role?.replace('_', ' ') || 'user' }}
          </span>
        </div>

        <div class="mt-6 space-y-4">
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              :value="auth.user.value?.email || ''"
              disabled
              class="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm text-gray-500 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Workspace</label>
            <input
              :value="auth.user.value?.tenantName || '-'"
              disabled
              class="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm text-gray-500 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Nama</label>
            <input
              v-model="profileName"
              class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              placeholder="Nama Anda"
            />
          </div>
        </div>

        <p v-if="profileMessage" class="mt-4 text-sm text-success-600 dark:text-success-400">{{ profileMessage }}</p>
        <p v-if="profileError" class="mt-4 text-sm text-error-600 dark:text-error-400">{{ profileError }}</p>

        <div class="mt-6 flex gap-3">
          <Button :disabled="profileLoading" @click="saveProfile">
            {{ profileLoading ? 'Menyimpan...' : 'Simpan Profil' }}
          </Button>
        </div>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div>
          <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Ganti Password</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Password baru minimal 8 karakter.
          </p>
        </div>

        <div class="mt-6 space-y-4">
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Password Lama</label>
            <input
              v-model="passwordForm.currentPassword"
              type="password"
              class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              placeholder="Password lama"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Password Baru</label>
            <input
              v-model="passwordForm.newPassword"
              type="password"
              class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              placeholder="Password baru"
            />
          </div>
        </div>

        <p v-if="passwordMessage" class="mt-4 text-sm text-success-600 dark:text-success-400">{{ passwordMessage }}</p>
        <p v-if="passwordError" class="mt-4 text-sm text-error-600 dark:text-error-400">{{ passwordError }}</p>

        <div class="mt-6 flex gap-3">
          <Button :disabled="passwordLoading" @click="savePassword">
            {{ passwordLoading ? 'Menyimpan...' : 'Ganti Password' }}
          </Button>
        </div>
      </section>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import { useAuth } from '@/composables/useAuth'

const auth = useAuth()

const profileName = ref('')
const profileLoading = ref(false)
const profileMessage = ref('')
const profileError = ref('')

const passwordLoading = ref(false)
const passwordMessage = ref('')
const passwordError = ref('')
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
})

async function hydrate() {
  await auth.fetchMe(true)
  profileName.value = auth.user.value?.name || ''
}

async function saveProfile() {
  profileLoading.value = true
  profileMessage.value = ''
  profileError.value = ''

  try {
    await auth.updateProfile(profileName.value)
    profileMessage.value = 'Profil berhasil diperbarui.'
  } catch (error) {
    profileError.value = error instanceof Error ? error.message : 'Gagal menyimpan profil'
  } finally {
    profileLoading.value = false
  }
}

async function savePassword() {
  passwordLoading.value = true
  passwordMessage.value = ''
  passwordError.value = ''

  try {
    await auth.changePassword(passwordForm.value.currentPassword, passwordForm.value.newPassword)
    passwordMessage.value = 'Password berhasil diperbarui.'
    passwordForm.value.currentPassword = ''
    passwordForm.value.newPassword = ''
  } catch (error) {
    passwordError.value = error instanceof Error ? error.message : 'Gagal memperbarui password'
  } finally {
    passwordLoading.value = false
  }
}

watch(
  () => auth.user.value?.name,
  (nextName) => {
    if (nextName) {
      profileName.value = nextName
    }
  },
)

onMounted(hydrate)
</script>
