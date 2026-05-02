<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Connection" />

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_340px]">
      <div class="space-y-6">
        <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">{{ instanceName }}</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ statusMeta.description }}</p>
            </div>
            <Badge :color="statusMeta.badgeColor">{{ connectionStatus }}</Badge>
          </div>

          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
              <p class="text-xs uppercase tracking-wide text-gray-500">Status</p>
              <p class="mt-2 font-medium text-gray-800 dark:text-white/90">{{ connectionStatus }}</p>
            </div>
            <div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
              <p class="text-xs uppercase tracking-wide text-gray-500">Nomor aktif</p>
              <p class="mt-2 font-medium text-gray-800 dark:text-white/90">{{ phoneNumber }}</p>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <Button :startIcon="RadioTower" :loading="pending" @click="connect">{{ pending ? 'Menghubungkan...' : isConnected ? 'Reconnect' : 'Create / Connect' }}</Button>
            <Button variant="outline" :loading="pending" :disabled="!canDisconnect" @click="disconnect">{{ pending ? 'Memutuskan...' : 'Disconnect' }}</Button>
            <Button variant="outline" :startIcon="RefreshCw" :loading="loading" @click="loadData">Refresh</Button>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">QR Pairing</h3>
        <div v-if="qrCode" class="mt-4 rounded-xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
          <img :src="qrCode" alt="QR WhatsApp" class="mx-auto w-full max-w-[240px] rounded-lg bg-white p-2" />
        </div>
        <p v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400">QR belum tersedia.</p>
      </div>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RadioTower, RefreshCw } from 'lucide-vue-next'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/composables/useToast'

type InstanceResponse = {
  instanceName?: string
  instance_name?: string
  status?: string
  phoneNumber?: string
  phone_number?: string
  qrCodeBase64?: string
  qr_code_base64?: string
  lastError?: string
  last_error?: string
}

const data = ref<InstanceResponse | null>(null)
const loading = ref(false)
const pending = ref(false)
const toast = useToast()

async function loadData() {
  loading.value = true
  try {
    data.value = await apiFetch<InstanceResponse>('/whatsapp/instance')
  } catch (error) {
    toast.notify({
      kind: 'error',
      title: 'Gagal memuat koneksi WhatsApp',
      message: error instanceof Error ? error.message : undefined,
    })
  } finally {
    loading.value = false
  }
}

async function connect() {
  pending.value = true
  try {
    await apiFetch('/whatsapp/instance/connect', { method: 'POST' })
    toast.notify({ kind: 'success', title: 'Koneksi WhatsApp sedang diproses' })
    await loadData()
  } catch (error) {
    toast.notify({
      kind: 'error',
      title: 'Gagal menghubungkan WhatsApp',
      message: error instanceof Error ? error.message : undefined,
    })
  } finally {
    pending.value = false
  }
}

async function disconnect() {
  pending.value = true
  try {
    await apiFetch('/whatsapp/instance/disconnect', { method: 'POST' })
    toast.notify({ kind: 'success', title: 'WhatsApp berhasil diputuskan' })
    await loadData()
  } catch (error) {
    toast.notify({
      kind: 'error',
      title: 'Gagal memutus koneksi WhatsApp',
      message: error instanceof Error ? error.message : undefined,
    })
  } finally {
    pending.value = false
  }
}

onMounted(loadData)

const instanceName = computed(() => data.value?.instanceName || data.value?.instance_name || 'redobot WA Asisten')
const connectionStatus = computed(() => String(data.value?.status || 'not_created'))
const phoneNumber = computed(() => data.value?.phoneNumber || data.value?.phone_number || 'Belum terhubung')
const qrCode = computed(() => data.value?.qrCodeBase64 || data.value?.qr_code_base64 || '')
const isConnected = computed(() => connectionStatus.value.toLowerCase() === 'connected')
const canDisconnect = computed(() => !['not_created', 'disconnected'].includes(connectionStatus.value.toLowerCase()))

const statusMeta = computed(() => {
  const status = connectionStatus.value.toLowerCase()
  if (status === 'connected') return { badgeColor: 'success' as const, description: 'Instance aktif dan siap menerima atau mengirim pesan.' }
  if (['connecting', 'qr', 'pairing'].includes(status)) return { badgeColor: 'warning' as const, description: 'Instance sedang menunggu pairing atau sinkronisasi.' }
  return { badgeColor: 'light' as const, description: 'Instance belum siap. Jalankan koneksi atau cek error.' }
})
</script>
