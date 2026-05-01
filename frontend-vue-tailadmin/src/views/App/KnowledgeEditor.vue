<template>
  <admin-layout>
    <PageBreadcrumb :pageTitle="editingId ? 'Edit Knowledge' : 'New Knowledge'" />

    <section class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div class="border-b border-gray-200 p-5 dark:border-gray-800">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 class="font-semibold text-gray-800 dark:text-white/90">{{ editingId ? 'Edit article' : 'Create article' }}</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Isi judul dan konten, lalu simpan untuk memperbarui knowledge.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <router-link to="/knowledge">
              <Button size="sm" variant="outline" :startIcon="ArrowLeft">Back to list</Button>
            </router-link>
            <Button v-if="editingId" size="sm" variant="outline" :startIcon="Trash2" :disabled="pending" @click="removeCurrent">Delete</Button>
            <Button size="sm" :startIcon="Save" :disabled="pending || !hasContent" @click="saveArticle">
              {{ pending ? 'Saving...' : editingId ? 'Update' : 'Save' }}
            </Button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 p-5">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Title</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="Contoh: Harga paket kursus"
            class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Content</label>
          <div class="overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div class="flex flex-wrap gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
              <button type="button" class="editor-btn" :class="toolbarClass(editor?.isActive('paragraph'))" @click="editor?.chain().focus().setParagraph().run()">P</button>
              <button type="button" class="editor-btn" :class="toolbarClass(editor?.isActive('heading', { level: 2 }))" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
              <button type="button" class="editor-btn" :class="toolbarClass(editor?.isActive('bold'))" @click="editor?.chain().focus().toggleBold().run()">Bold</button>
              <button type="button" class="editor-btn" :class="toolbarClass(editor?.isActive('italic'))" @click="editor?.chain().focus().toggleItalic().run()">Italic</button>
              <button type="button" class="editor-btn" :class="toolbarClass(editor?.isActive('bulletList'))" @click="editor?.chain().focus().toggleBulletList().run()">Bullet</button>
              <button type="button" class="editor-btn" :class="toolbarClass(editor?.isActive('orderedList'))" @click="editor?.chain().focus().toggleOrderedList().run()">Number</button>
              <button type="button" class="editor-btn" :class="toolbarClass(editor?.isActive('link'))" @click="setLink">Link</button>
              <button type="button" class="editor-btn" @click="editor?.chain().focus().unsetLink().run()">Unlink</button>
              <button type="button" class="editor-btn" @click="editor?.chain().focus().undo().run()">Undo</button>
              <button type="button" class="editor-btn" @click="editor?.chain().focus().redo().run()">Redo</button>
            </div>

            <EditorContent :editor="editor" class="knowledge-editor" />
          </div>
        </div>
      </div>
    </section>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Save, Trash2 } from 'lucide-vue-next'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import { apiFetch } from '@/lib/api'

type KnowledgeArticle = {
  id: number
  title: string
  content: string
}

const route = useRoute()
const router = useRouter()
const pending = ref(false)
const editingId = computed(() => {
  const raw = route.params.id
  return raw ? Number(raw) : null
})

const form = reactive({
  title: '',
  content: '',
})

const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
    }),
  ],
  content: '',
  editorProps: {
    attributes: {
      class:
        'h-full w-full px-4 py-3 text-sm leading-7 text-gray-800 focus:outline-hidden dark:text-white/90',
    },
  },
  onUpdate: ({ editor }) => {
    form.content = editor.getHTML()
  },
})

async function loadArticle() {
  if (!editingId.value) return

  const articles = await apiFetch<Array<KnowledgeArticle & { status?: string }>>('/knowledge')
  const article = articles.find(item => item.id === editingId.value)

  if (!article) {
    await router.push('/knowledge')
    return
  }

  form.title = article.title
  form.content = article.content
  editor.value?.commands.setContent(article.content || '<p></p>', { emitUpdate: false })
}

async function saveArticle() {
  if (!form.title.trim() || !form.content.trim()) return
  pending.value = true
  try {
    if (editingId.value) {
      await apiFetch(`/knowledge/${editingId.value}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: form.title, content: form.content }),
      })
    } else {
      await apiFetch('/knowledge', {
        method: 'POST',
        body: JSON.stringify({ title: form.title, content: form.content }),
      })
    }
    await router.push('/knowledge')
  } finally {
    pending.value = false
  }
}

async function removeCurrent() {
  if (!editingId.value) return
  const confirmed = window.confirm('Hapus artikel ini?')
  if (!confirmed) return

  pending.value = true
  try {
    await apiFetch(`/knowledge/${editingId.value}`, { method: 'DELETE' })
    await router.push('/knowledge')
  } finally {
    pending.value = false
  }
}

function plainTextFromHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toolbarClass(active?: boolean) {
  return active
    ? 'bg-brand-500 text-white border-brand-500'
    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/[0.03]'
}

function setLink() {
  const previousUrl = editor.value?.getAttributes('link').href || ''
  const url = window.prompt('Masukkan URL', previousUrl)
  if (url === null) return

  const trimmed = url.trim()
  if (!trimmed) {
    editor.value?.chain().focus().unsetLink().run()
    return
  }

  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
}

const hasContent = computed(() => !!form.title.trim() && !!plainTextFromHtml(form.content))

watch(editor, current => {
  if (current && form.content) {
    current.commands.setContent(form.content, { emitUpdate: false })
  }
})

onMounted(loadArticle)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
:deep(.knowledge-editor) {
  height: 420px;
  overflow-y: auto;
}

:deep(.knowledge-editor .tiptap) {
  min-height: 100%;
}

:deep(.knowledge-editor .tiptap h2) {
  margin: 1rem 0 0.5rem;
  font-size: 1.5rem;
  font-weight: 600;
}

:deep(.knowledge-editor .tiptap p) {
  margin: 0.5rem 0;
}

:deep(.knowledge-editor .tiptap ul) {
  list-style: disc;
  padding-left: 1.5rem;
}

:deep(.knowledge-editor .tiptap ol) {
  list-style: decimal;
  padding-left: 1.5rem;
}

:deep(.knowledge-editor .tiptap a) {
  color: var(--color-brand-500);
  text-decoration: underline;
}

.editor-btn {
  border-width: 1px;
  border-style: solid;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
}
</style>
