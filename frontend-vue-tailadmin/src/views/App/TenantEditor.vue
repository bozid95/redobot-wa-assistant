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
                {{ editingId ? 'Perbarui identitas tenant dan assignment AI template dari halaman ini.' : 'Buat tenant baru dengan flow yang lebih rapi, lalu pilih template assistant yang sesuai.' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <router-link to="/tenants">
                <Button size="sm" variant="outline" :startIcon="ArrowLeft">Back to list</Button>
              </router-link>
              <Button size="sm" :startIcon="Save" :disabled="pending || !canSave" @click="saveTenant">
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
          <div class="lg:col-span-2">
            <label class="form-label">AI Template</label>
            <select v-model.number="form.templateId" class="form-input">
              <option :value="0">Tanpa template</option>
              <option v-for="template in templates" :key="template.id" :value="template.id">
                {{ template.name }}
              </option>
            </select>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Tenant akan mewarisi flow dari template ini. Override tenant bisa ditambahkan nanti jika memang dibutuhkan.
            </p>
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
              Ringkasan ini membantu sebelum kamu mengubah assignment template atau menghapus tenant.
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
            <p class="text-xs uppercase tracking-wide text-gray-500">Assigned Template</p>
            <p class="mt-2 text-sm font-semibold text-gray-800 dark:text-white/90">{{ selectedTemplateName }}</p>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <Button variant="outline" :disabled="!form.templateId" @click="openSelectedTemplate">
            Open Template
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
            :disabled="deleting || !confirmDelete"
            @click="deleteTenant"
          >
            {{ deleting ? 'Deleting...' : 'Delete Tenant' }}
          </Button>
        </div>
      </section>

      <p v-if="errorMessage" class="text-sm text-error-600 dark:text-error-400">{{ errorMessage }}</p>
      <p v-if="successMessage" class="text-sm text-success-600 dark:text-success-400">{{ successMessage }}</p>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Save } from 'lucide-vue-next'
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

type TenantPayload = {
  id: number
  name: string
  slug: string
  users: Array<{ id: number }>
  waInstances: Array<{ id: number }>
  ragConfig?: {
    assistantTemplateId: number | null
    assistantTemplate: AssistantTemplateSummary | null
  } | null
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
const editingId = computed(() => {
  const raw = route.params.id
  return raw ? Number(raw) : null
})

const templates = ref<AssistantTemplateSummary[]>([])
const pending = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  name: '',
  templateId: 0,
})

const tenantStats = reactive({
  users: 0,
  instances: 0,
})

const canSave = computed(() => !!form.name.trim())
const slugPreview = computed(() => slugifyTenantName(form.name))
const selectedTemplateName = computed(() => {
  return templates.value.find((item) => item.id === form.templateId)?.name || 'Belum dipilih'
})

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

async function loadTemplates() {
  templates.value = await apiFetch<AssistantTemplateSummary[]>('/rag-config/templates')
}

function resetEditorState() {
  form.name = ''
  form.templateId = 0
  tenantStats.users = 0
  tenantStats.instances = 0
  confirmDelete.value = false
}

async function loadTenant() {
  resetEditorState()
  if (!editingId.value) return

  const tenant = await apiFetch<TenantPayload>(`/tenants/${editingId.value}`)
  form.name = tenant.name
  form.templateId = tenant.ragConfig?.assistantTemplateId || 0
  tenantStats.users = tenant.users.length
  tenantStats.instances = tenant.waInstances.length
}

async function bootstrap() {
  clearMessages()

  const results = await Promise.allSettled([loadTemplates(), loadTenant()])
  const templateResult = results[0]
  const tenantResult = results[1]

  if (tenantResult.status === 'rejected') {
    errorMessage.value =
      tenantResult.reason instanceof Error
        ? tenantResult.reason.message
        : 'Gagal memuat data tenant'
    return
  }

  if (templateResult.status === 'rejected') {
    errorMessage.value =
      templateResult.reason instanceof Error
        ? `${templateResult.reason.message}. Data tenant tetap dimuat, tetapi daftar template belum tersedia.`
        : 'Daftar template belum tersedia, tetapi data tenant berhasil dimuat.'
  }
}

async function persistTemplateAssignment(tenantId: number) {
  await apiFetch(`/rag-config/template-assignment?tenantId=${tenantId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      templateId: form.templateId || null,
      clearAssistantFlowOverride: false,
    }),
  })
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
      await persistTemplateAssignment(editingId.value)
      successMessage.value = 'Tenant berhasil diperbarui.'
      await loadTenant()
    } else {
      const created = await apiFetch<TenantPayload>('/tenants', {
        method: 'POST',
        body: JSON.stringify({ name: form.name }),
      })
      await persistTemplateAssignment(created.id)
      await router.push('/tenants')
      return
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal menyimpan tenant'
  } finally {
    pending.value = false
  }
}

function openSelectedTemplate() {
  if (!form.templateId) return
  router.push(`/ai-settings/rag-config/${form.templateId}/edit`)
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
    await router.push('/tenants')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal menghapus tenant'
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
