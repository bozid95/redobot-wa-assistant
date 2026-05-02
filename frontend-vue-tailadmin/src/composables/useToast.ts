import { readonly, ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export type ToastItem = {
  id: number
  kind: ToastKind
  title: string
  message?: string
}

const toasts = ref<ToastItem[]>([])
let nextId = 1

type NotifyInput = {
  kind?: ToastKind
  title: string
  message?: string
  timeout?: number
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function notify(input: NotifyInput) {
  const id = nextId++
  toasts.value.push({
    id,
    kind: input.kind || 'info',
    title: input.title,
    message: input.message,
  })

  window.setTimeout(() => dismiss(id), input.timeout ?? 3600)
  return id
}

export function useToast() {
  return {
    toasts: readonly(toasts),
    notify,
    dismiss,
  }
}
