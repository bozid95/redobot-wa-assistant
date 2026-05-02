<template>
  <Teleport to="body">
    <div class="fixed top-20 right-4 z-[1000000] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="rounded-xl border bg-white p-4 shadow-lg shadow-gray-900/10 dark:bg-gray-900"
          :class="toneClass(toast.kind)"
        >
          <div class="flex items-start gap-3">
            <component :is="toneIcon(toast.kind)" class="mt-0.5 size-5 flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ toast.title }}</p>
              <p v-if="toast.message" class="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">
                {{ toast.message }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200"
              aria-label="Tutup alert"
              @click="dismiss(toast.id)"
            >
              <X class="size-4" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next'
import { useToast, type ToastKind } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

function toneClass(kind: ToastKind) {
  if (kind === 'success') return 'border-success-200 dark:border-success-500/30'
  if (kind === 'error') return 'border-error-200 dark:border-error-500/30'
  if (kind === 'warning') return 'border-warning-200 dark:border-warning-500/30'
  return 'border-brand-200 dark:border-brand-500/30'
}

function toneIcon(kind: ToastKind) {
  if (kind === 'success') return CheckCircle2
  if (kind === 'error') return AlertCircle
  if (kind === 'warning') return AlertCircle
  return Info
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
