import { readonly, ref } from 'vue'
import { apiFetch } from '@/lib/api'

type AuthUser = {
  id: number
  name: string
  email: string
  role: 'platform_admin' | 'tenant_admin' | 'tenant_staff'
  tenantId: number | null
  tenantName: string | null
  isActive: boolean
}

const user = ref<AuthUser | null>(null)
const hydrated = ref(false)
const loading = ref(false)

export function useAuth() {
  async function fetchMe(force = false) {
    if (loading.value) return user.value
    if (hydrated.value && !force) return user.value

    loading.value = true

    try {
      user.value = await apiFetch<AuthUser>('/auth/me')
    } catch {
      user.value = null
    } finally {
      hydrated.value = true
      loading.value = false
    }

    return user.value
  }

  async function login(email: string, password: string) {
    user.value = await apiFetch<AuthUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    hydrated.value = true
    return user.value
  }

  async function updateProfile(name: string) {
    user.value = await apiFetch<AuthUser>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
    hydrated.value = true
    return user.value
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    return apiFetch<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  async function logout() {
    await apiFetch('/auth/logout', { method: 'POST' })
    user.value = null
    hydrated.value = true
  }

  return {
    user: readonly(user),
    hydrated: readonly(hydrated),
    loading: readonly(loading),
    fetchMe,
    login,
    updateProfile,
    changePassword,
    logout,
  }
}
