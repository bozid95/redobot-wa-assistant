<template>
  <ThemeProvider>
    <SidebarProvider>
      <RouterView />
      <ToastHost />
    </SidebarProvider>
  </ThemeProvider>
</template>

<script setup lang="ts">
import ThemeProvider from './components/layout/ThemeProvider.vue'
import SidebarProvider from './components/layout/SidebarProvider.vue'
import ToastHost from './components/ui/ToastHost.vue'
</script>
