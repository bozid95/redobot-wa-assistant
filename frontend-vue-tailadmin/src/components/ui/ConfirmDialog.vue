<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="open" class="fixed inset-0 z-[1000001] flex items-center justify-center bg-gray-900/45 px-4">
        <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
          <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{{ message }}</p>

          <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" :disabled="loading" @click="$emit('cancel')">
              {{ cancelText }}
            </Button>
            <Button
              :disabled="loading"
              className="bg-error-600 hover:bg-error-700 focus:ring-error-500/20"
              @click="$emit('confirm')"
            >
              {{ loading ? loadingText : confirmText }}
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    loadingText?: string
    loading?: boolean
  }>(),
  {
    confirmText: 'Hapus',
    cancelText: 'Batal',
    loadingText: 'Menghapus...',
    loading: false,
  },
)

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<style scoped>
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.16s ease;
}

.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}
</style>
