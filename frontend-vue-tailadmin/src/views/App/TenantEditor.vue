<template>
  <admin-layout>
    <PageBreadcrumb :pageTitle="editingId ? 'Edit Tenant' : 'Add Tenant'" />

    <div class="space-y-6">
      <section class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="border-b border-gray-200 p-5 dark:border-gray-800">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 class="font-semibold text-gray-800 dark:text-white/90">{{ editingId ? 'Edit tenant' : 'Create tenant' }}</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ editingId ? 'Perbarui identitas tenant dan lanjutkan setup AI dari halaman ini.' : 'Buat tenant baru, lalu setup AI tenant melalui Latih AI.' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <router-link to="/tenants">
                <Button size="sm" variant="outline" :startIcon="ArrowLeft">Back to list</Button>
              </router-link>
              <Button size="sm" :startIcon="Save" :loading="pending" :disabled="!canSave" @click="saveTenant">
                {{ pending ? 'Saving...' : editingId ? 'Update Tenant' : 'Create Tenant' }}
              </Button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
          <div>
            <label class="form-label">Nama Tenant</label>
            <input v-model="form.name" class="form-input" placeholder="Contoh: Cabang Bandung" />
          </div>
          <div>
            <label class="form-label">Slug Preview</label>
            <div class="form-static">{{ slugPreview }}</div>
          </div>
        </div>
      </section>

      <section
        v-if="editingId"
        class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="font-semibold text-gray-800 dark:text-white/90">Tenant Snapshot</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Ringkasan ini membantu sebelum kamu membuka Latih AI atau menghapus tenant.
            </p>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">Users</p>
            <p class="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ tenantStats.users }}</p>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">WA Instances</p>
            <p class="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{{ tenantStats.instances }}</p>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
            <p class="text-xs uppercase tracking-wide text-gray-500">AI Setup</p>
            <p class="mt-2 text-sm font-semibold text-gray-800 dark:text-white/90">Latih AI Tenant</p>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <Button @click="openTenantTraining">
            Buka Latih AI Tenant
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
            Hapus tenant secara permanen. User, instance, knowledge, dan conversation yang terkait akan terlepas dari tenant ini.
          </p>
        </div>

        <div class="mt-5 flex items-center gap-3 rounded-xl border border-error-200 px-4 py-3 dark:border-error-500/30">
          <input v-model="confirmDelete" type="checkbox" />
          <span class="text-sm text-gray-700 dark:text-gray-300">Saya yakin ingin menghapus tenant ini</span>
        </div>

        <div class="mt-5">
          <Button
            size="sm"
            variant="outline"
            className="border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-300"
            :loading="deleting"
            :disabled="!confirmDelete"
            @click="showDeleteConfirm = true"
          >
            {{ deleting ? 'Deleting...' : 'Delete Tenant' }}
          </Button>
        </div>
      </section>

      <p v-if="errorMessage" class="text-sm text-error-600 dark:text-error-400">{{ errorMessage }}</p>
      <p v-if="successMessage" class="text-sm text-success-600 dark:text-success-400">{{ successMessage }}</p>
    </div>

    <ConfirmDialog
      :open="showDeleteConfirm"
      title="Hapus tenant?"
      message="Tenant akan dihapus permanen dan data terkait akan dilepas dari tenant ini. Aksi ini tidak bisa dibatalkan."
      confirmText="Hapus Tenant"
      :loading="deleting"
      @cancel="showDeleteConfirm = false"
      @confirm="deleteTenant"
    />
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Save } from 'lucide-vue-next'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/composables/useToast'

type TenantPayload = {
  id: number
  name: string
  slug: string
  users: Array<{ id: number }>
  waInstances: Array<{ id: number }>
}

type DeleteTenantResponse = {
  id: number
  name: string
  detachedUsers: number
  detachedInstances: number
  detachedKnowledgeSources: number
  detachedConversations: number
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const editingId = computed(() => {
  const raw = route.params.id
  return raw ? Number(raw) : null
})

const pending = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const showDeleteConfirm = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  name: '',
})

const tenantStats = reactive({
  users: 0,
  instances: 0,
})

const canSave = computed(() => !!form.name.trim())
const slugPreview = computed(() => slugifyTenantName(form.name))

function slugifyTenantName(value: string) {
  return (
    String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tenant'
  )
}

function clearMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

function resetEditorState() {
  form.name = ''
  tenantStats.users = 0
  tenantStats.instances = 0
  confirmDelete.value = false
}

async function loadTenant() {
  resetEditorState()
  if (!editingId.value) return

  const tenant = await apiFetch<TenantPayload>(`/tenants/${editingId.value}`)
  form.name = tenant.name
  tenantStats.users = tenant.users.length
  tenantStats.instances = tenant.waInstances.length
}

async function bootstrap() {
  clearMessages()

  try {
    await loadTenant()
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Gagal memuat data tenant'
    toast.notify({ kind: 'error', title: 'Gagal memuat tenant', message: errorMessage.value })
  }
}

async function saveTenant() {
  pending.value = true
  clearMessages()

  try {
    if (editingId.value) {
      await apiFetch(`/tenants/${editingId.value}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name }),
      })
      successMessage.value = 'Tenant berhasil diperbarui.'
      toast.notify({ kind: 'success', title: 'Tenant berhasil diperbarui' })
      await loadTenant()
    } else {
      const created = await apiFetch<TenantPayload>('/tenants', {
        method: 'POST',
        body: JSON.stringify({ name: form.name }),
      })
      toast.notify({ kind: 'success', title: 'Tenant berhasil dibuat', message: created.name })
      await router.push('/tenants')
      return
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal menyimpan tenant'
    toast.notify({ kind: 'error', title: 'Gagal menyimpan tenant', message: errorMessage.value })
  } finally {
    pending.value = false
  }
}

function openTenantTraining() {
  if (!editingId.value) return
  router.push(`/ai-training?tenantId=${editingId.value}`)
}

async function deleteTenant() {
  if (!editingId.value) return

  deleting.value = true
  clearMessages()

  try {
    const result = await apiFetch<DeleteTenantResponse>(`/tenants/${editingId.value}`, {
      method: 'DELETE',
    })
    successMessage.value = `Tenant dihapus. ${result.detachedUsers} user, ${result.detachedInstances} instance, ${result.detachedKnowledgeSources} knowledge source, dan ${result.detachedConversations} conversation dilepas dari tenant ini.`
    toast.notify({ kind: 'success', title: 'Tenant berhasil dihapus', message: result.name })
    showDeleteConfirm.value = false
    await router.push('/tenants')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal menghapus tenant'
    toast.notify({ kind: 'error', title: 'Gagal menghapus tenant', message: errorMessage.value })
  } finally {
    deleting.value = false
  }
}

onMounted(bootstrap)

watch(
  () => route.params.id,
  (next, previous) => {
    if (next === previous) return
    void bootstrap()
  },
)
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

.form-static {
  width: 100%;
  min-height: 2.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(229 231 235);
  background: rgb(249 250 251);
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: rgb(107 114 128);
}

.dark .form-static {
  border-color: rgb(31 41 55);
  background: rgb(17 24 39);
  color: rgb(156 163 175);
}
</style>
