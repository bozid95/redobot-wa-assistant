<template>
  <admin-layout>
    <PageBreadcrumb :pageTitle="isEditing ? 'Edit AI Template' : 'New AI Template'" />

    <div class="space-y-6">
      <section class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-xl font-semibold text-gray-800 dark:text-white/90">{{ isEditing ? 'AI Template Editor' : 'Create AI Template' }}</h3>
              <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                {{ isEditing ? 'Template Edit Mode' : 'Template Create Mode' }}
              </span>
              <span
                v-if="templateMeta.isSystem"
                class="rounded-full bg-warning-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning-700 dark:bg-warning-500/10 dark:text-warning-300"
              >
                System Template
              </span>
              <span
                v-else-if="isEditing"
                class="rounded-full bg-success-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-success-700 dark:bg-success-500/10 dark:text-success-300"
              >
                Custom Template
              </span>
            </div>
            <p class="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Rancang satu template assistant yang nanti bisa dipakai banyak tenant. Semua konfigurasi flow bisnis tetap ada di sini: profile, intents, fields, actions, routing, preview, dan
              advanced retrieval.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[380px]">
            <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
              <p class="text-xs uppercase tracking-wide text-gray-500">Slug</p>
              <p class="mt-1 font-medium text-gray-800 dark:text-white/90">{{ templateMeta.slug || 'Belum dibuat' }}</p>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
              <p class="text-xs uppercase tracking-wide text-gray-500">Updated</p>
              <p class="mt-1 font-medium text-gray-800 dark:text-white/90">{{ templateMeta.updatedAt }}</p>
            </div>
            <div class="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 sm:col-span-2 dark:border-gray-800 dark:bg-gray-900">
              <p class="text-xs uppercase tracking-wide text-gray-500">Template Purpose</p>
              <p class="mt-1 font-medium text-gray-800 dark:text-white/90">
                {{ templateForm.description || 'Belum ada deskripsi template. Tambahkan ringkasan agar admin mudah memilih template ini saat assign ke tenant.' }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <label class="form-label">Template Name</label>
            <input v-model="templateForm.name" class="form-input" placeholder="Contoh: Klinik Gigi - Booking & FAQ" />
          </div>
          <div>
            <label class="form-label">Description</label>
            <textarea
              v-model="templateForm.description"
              class="form-textarea"
              rows="3"
              placeholder="Template untuk bisnis yang butuh FAQ, booking, handoff admin, dan pengumpulan data pelanggan."
            />
          </div>
        </div>

        <div class="mt-6 flex flex-wrap gap-3">
          <Button :disabled="savingTemplate || loadingTemplate" @click="saveTemplate">
            {{ savingTemplate ? 'Saving Template...' : isEditing ? 'Update Template' : 'Create Template' }}
          </Button>
          <Button variant="outline" :disabled="loadingTemplate" @click="loadExample">
            Load Example
          </Button>
          <Button variant="outline" :disabled="loadingTemplate" @click="resetDraft">
            Reset Draft
          </Button>
          <Button variant="outline" :disabled="copyingPayload" @click="copyPayload">
            {{ copyingPayload ? 'Copying...' : 'Copy Payload' }}
          </Button>
          <Button variant="outline" :disabled="loadingTemplate" @click="reloadTemplate">
            {{ loadingTemplate ? 'Refreshing...' : 'Reload Template' }}
          </Button>
          <Button variant="outline" @click="backToTemplates">
            Back to Templates
          </Button>
        </div>

        <p v-if="flashMessage" :class="['mt-4 text-sm', flashClass]">{{ flashMessage }}</p>
      </section>

      <section class="rounded-3xl border border-dashed border-brand-200 bg-brand-50/70 p-5 dark:border-brand-500/30 dark:bg-brand-500/5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 class="text-base font-semibold text-gray-800 dark:text-white/90">Template Summary</h4>
            <p class="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
              Gunakan layar ini untuk merancang template global. Setelah selesai, tenant tinggal memilih template yang cocok tanpa harus membangun flow bisnis dari nol.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-2xl border border-white/80 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900/80">
              <p class="text-xs uppercase tracking-wide text-gray-500">Intents</p>
              <p class="mt-2 text-xl font-semibold text-gray-800 dark:text-white/90">{{ draft.intents.length }}</p>
            </div>
            <div class="rounded-2xl border border-white/80 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900/80">
              <p class="text-xs uppercase tracking-wide text-gray-500">Fields</p>
              <p class="mt-2 text-xl font-semibold text-gray-800 dark:text-white/90">{{ draft.fields.length }}</p>
            </div>
            <div class="rounded-2xl border border-white/80 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900/80">
              <p class="text-xs uppercase tracking-wide text-gray-500">Actions</p>
              <p class="mt-2 text-xl font-semibold text-gray-800 dark:text-white/90">{{ draft.actions.length }}</p>
            </div>
            <div class="rounded-2xl border border-white/80 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900/80">
              <p class="text-xs uppercase tracking-wide text-gray-500">Rules</p>
              <p class="mt-2 text-xl font-semibold text-gray-800 dark:text-white/90">{{ draft.routingRules.length }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="[
              'rounded-2xl px-4 py-3 text-sm font-medium transition',
              activeTab === tab.id
                ? 'bg-brand-500 text-white shadow-theme-xs'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
            ]"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </section>

      <div v-if="activeTab === 'profile'" class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Profile</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Persona utama assistant, konteks bisnis, dan pesan dasar yang menjadi pintu masuk template.
            </p>
          </div>

          <div class="mt-6 grid grid-cols-1 gap-4">
            <div>
              <label class="form-label">Assistant Name</label>
              <input v-model="draft.profile.assistantName" class="form-input" placeholder="Contoh: Nara Assistant" />
            </div>
            <div>
              <label class="form-label">Business Context</label>
              <textarea v-model="draft.profile.businessContext" class="form-textarea" rows="3" placeholder="Contoh: layanan konsultasi dan reservasi klinik gigi keluarga" />
            </div>
            <div>
              <label class="form-label">Greeting Message</label>
              <textarea v-model="draft.profile.greetingMessage" class="form-textarea" rows="3" />
            </div>
            <div>
              <label class="form-label">Clarify Message</label>
              <textarea v-model="draft.profile.clarifyMessage" class="form-textarea" rows="3" />
            </div>
            <div>
              <label class="form-label">Fallback Message</label>
              <textarea v-model="draft.profile.fallbackMessage" class="form-textarea" rows="3" />
            </div>
            <div>
              <label class="form-label">Thanks Message</label>
              <textarea v-model="draft.profile.thanksMessage" class="form-textarea" rows="3" />
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Opening Menu</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Menu pembuka opsional untuk template yang ingin menawarkan jalur pertanyaan lebih terarah.
              </p>
            </div>
            <label class="inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
              <input v-model="draft.profile.menuEnabled" type="checkbox" class="size-4 rounded border-gray-300" />
              Aktifkan menu pembuka
            </label>
          </div>

          <div class="mt-6 space-y-4">
            <div
              v-for="(item, index) in draft.profile.menuItems"
              :key="item.id"
              class="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-semibold text-gray-800 dark:text-white/90">Menu {{ index + 1 }}</p>
                <button type="button" class="ghost-btn text-error-600 dark:text-error-400" @click="removeMenuItem(index)">Remove</button>
              </div>
              <div class="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label class="form-label">Label</label>
                  <input v-model="item.label" class="form-input" placeholder="Contoh: Tanya harga" />
                </div>
                <div>
                  <label class="form-label">Prompt Rewrite</label>
                  <textarea v-model="item.prompt" class="form-textarea" rows="3" placeholder="Contoh: tolong tampilkan harga layanan yang tersedia" />
                </div>
              </div>
            </div>

            <Button variant="outline" @click="addMenuItem">Add Menu Item</Button>
          </div>
        </section>
      </div>

      <section
        v-else-if="activeTab === 'intents'"
        class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Intents</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Intent dibuat sebagai katalog template. Tenant yang memakai template ini akan mewarisi keyword dan search hints yang sama.
            </p>
          </div>
          <Button variant="outline" @click="addIntent">Add Intent</Button>
        </div>

        <div class="mt-6 space-y-4">
          <div
            v-for="(intent, index) in draft.intents"
            :key="intent.id"
            class="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-semibold text-gray-800 dark:text-white/90">Intent {{ index + 1 }}</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Key unik dipakai untuk routing rule dan payload backend.</p>
              </div>
              <button type="button" class="ghost-btn text-error-600 dark:text-error-400" @click="removeIntent(index)">Remove</button>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <label class="form-label">Intent Key</label>
                <input v-model="intent.key" class="form-input" placeholder="Contoh: pricing" />
              </div>
              <div>
                <label class="form-label">Label</label>
                <input v-model="intent.label" class="form-input" placeholder="Contoh: Pricing Inquiry" />
              </div>
              <div class="xl:col-span-2">
                <label class="form-label">Keywords</label>
                <textarea
                  class="form-textarea"
                  rows="3"
                  :value="toCsv(intent.keywords)"
                  placeholder="harga, biaya, tarif"
                  @input="setStringList(intent, 'keywords', $event)"
                />
              </div>
              <div class="xl:col-span-2">
                <label class="form-label">Search Hints</label>
                <textarea
                  class="form-textarea"
                  rows="3"
                  :value="toCsv(intent.searchHints)"
                  placeholder="harga layanan, daftar biaya, promo"
                  @input="setStringList(intent, 'searchHints', $event)"
                />
              </div>
              <div class="xl:col-span-2">
                <label class="form-label">Default Action</label>
                <select v-model="intent.defaultAction" class="form-input">
                  <option :value="null">Belum dipilih</option>
                  <option v-for="action in draft.actions" :key="action.id" :value="action.key">
                    {{ action.label || action.key }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'fields'"
        class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Fields</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Definisikan field bisnis yang ingin dikumpulkan tanpa menanam nama field spesifik langsung di core engine.
            </p>
          </div>
          <Button variant="outline" @click="addField">Add Field</Button>
        </div>

        <div class="mt-6 space-y-4">
          <div
            v-for="(field, index) in draft.fields"
            :key="field.id"
            class="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-semibold text-gray-800 dark:text-white/90">Field {{ index + 1 }}</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Gunakan key generik seperti `full_name`, `service_type`, atau `preferred_date`.</p>
              </div>
              <button type="button" class="ghost-btn text-error-600 dark:text-error-400" @click="removeField(index)">Remove</button>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <label class="form-label">Field Key</label>
                <input v-model="field.key" class="form-input" placeholder="Contoh: full_name" />
              </div>
              <div>
                <label class="form-label">Label</label>
                <input v-model="field.label" class="form-input" placeholder="Contoh: Nama Lengkap" />
              </div>
              <div>
                <label class="form-label">Type</label>
                <select v-model="field.type" class="form-input">
                  <option v-for="type in fieldTypeOptions" :key="type" :value="type">{{ type }}</option>
                </select>
              </div>
              <div class="flex items-end">
                <label class="inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-200">
                  <input v-model="field.required" type="checkbox" class="size-4 rounded border-gray-300" />
                  Required field
                </label>
              </div>
              <div>
                <label class="form-label">Placeholder</label>
                <input v-model="field.placeholder" class="form-input" placeholder="Contoh: Tulis nama lengkap Anda" />
              </div>
              <div>
                <label class="form-label">Help Text</label>
                <input v-model="field.helpText" class="form-input" placeholder="Contoh: Data ini dipakai untuk verifikasi reservasi" />
              </div>
              <div v-if="field.type === 'select'" class="xl:col-span-2">
                <label class="form-label">Options</label>
                <textarea
                  class="form-textarea"
                  rows="3"
                  :value="toCsv(field.options || [])"
                  placeholder="Basic, Premium, VIP"
                  @input="setFieldOptions(field, $event)"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'actions'"
        class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Actions</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Action menjadi katalog respons template. V1 cukup lima tipe bawaan untuk menutup use case umum tanpa builder visual.
            </p>
          </div>
          <Button variant="outline" @click="addAction">Add Action</Button>
        </div>

        <div class="mt-6 space-y-4">
          <div
            v-for="(action, index) in draft.actions"
            :key="action.id"
            class="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-semibold text-gray-800 dark:text-white/90">Action {{ index + 1 }}</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Action ini nantinya dipakai ulang oleh intent dan rule tenant yang memakai template yang sama.</p>
              </div>
              <button type="button" class="ghost-btn text-error-600 dark:text-error-400" @click="removeAction(index)">Remove</button>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <label class="form-label">Action Key</label>
                <input v-model="action.key" class="form-input" placeholder="Contoh: answer_pricing" />
              </div>
              <div>
                <label class="form-label">Label</label>
                <input v-model="action.label" class="form-input" placeholder="Contoh: Answer Pricing from Knowledge" />
              </div>
              <div>
                <label class="form-label">Action Type</label>
                <select v-model="action.type" class="form-input">
                  <option v-for="type in actionTypeOptions" :key="type" :value="type">{{ type }}</option>
                </select>
              </div>
              <div v-if="action.type === 'collect_fields'">
                <label class="form-label">Field Keys</label>
                <textarea
                  class="form-textarea"
                  rows="3"
                  :value="toCsv(action.fieldKeys || [])"
                  placeholder="full_name, phone, preferred_date"
                  @input="setActionFields(action, $event)"
                />
              </div>
              <div :class="action.type === 'collect_fields' ? 'xl:col-span-2' : 'xl:col-span-2'">
                <label class="form-label">Message Template</label>
                <textarea
                  v-model="action.messageTemplate"
                  class="form-textarea"
                  rows="4"
                  placeholder="Contoh: Saya bantu cek harga dari knowledge aktif ya kak."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'routing'"
        class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Routing</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Routing rule v1 sengaja sederhana: intent ke action, lalu tambahkan kondisi ringan bila masih ada field yang belum lengkap atau confidence terlalu rendah.
            </p>
          </div>
          <Button variant="outline" @click="addRoutingRule">Add Rule</Button>
        </div>

        <div class="mt-6 space-y-4">
          <div
            v-for="(rule, index) in draft.routingRules"
            :key="rule.id"
            class="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-semibold text-gray-800 dark:text-white/90">Rule {{ index + 1 }}</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Rule dipakai untuk contoh routing preview dan payload backend baru.</p>
              </div>
              <button type="button" class="ghost-btn text-error-600 dark:text-error-400" @click="removeRoutingRule(index)">Remove</button>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <label class="form-label">Intent</label>
                <select v-model="rule.intentKey" class="form-input">
                  <option value="">Pilih intent</option>
                  <option v-for="intent in draft.intents" :key="intent.id" :value="intent.key">
                    {{ intent.label || intent.key }}
                  </option>
                </select>
              </div>
              <div>
                <label class="form-label">Action</label>
                <select v-model="rule.actionKey" class="form-input">
                  <option value="">Pilih action</option>
                  <option v-for="action in draft.actions" :key="action.id" :value="action.key">
                    {{ action.label || action.key }}
                  </option>
                </select>
              </div>
              <div>
                <label class="form-label">If Missing Fields</label>
                <textarea
                  class="form-textarea"
                  rows="3"
                  :value="toCsv(rule.ifMissingFields || [])"
                  placeholder="phone, preferred_date"
                  @input="setRoutingMissingFields(rule, $event)"
                />
              </div>
              <div>
                <label class="form-label">If Confidence Below</label>
                <input v-model.number="rule.ifConfidenceBelow" class="form-input" type="number" min="0" max="1" step="0.05" placeholder="0.45" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-else-if="activeTab === 'preview'" class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section class="space-y-6">
          <section class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Config Summary</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Ringkasan cepat untuk melihat apakah template sudah cukup lengkap sebelum dipakai banyak tenant.
              </p>
            </div>

            <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div class="summary-card">
                <p class="summary-label">Required Fields</p>
                <p class="summary-value">{{ requiredFieldsCount }}</p>
              </div>
              <div class="summary-card">
                <p class="summary-label">Menu Items</p>
                <p class="summary-value">{{ draft.profile.menuEnabled ? draft.profile.menuItems.length : 0 }}</p>
              </div>
              <div class="summary-card">
                <p class="summary-label">Mapped Intents</p>
                <p class="summary-value">{{ mappedIntentCount }}</p>
              </div>
              <div class="summary-card">
                <p class="summary-label">Collect Actions</p>
                <p class="summary-value">{{ collectActionCount }}</p>
              </div>
            </div>
          </section>

          <section class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Sample Routing</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Preview sederhana untuk memastikan intent, action, dan rule sudah terbaca secara konsisten oleh template ini.
                </p>
              </div>
            </div>

            <div class="mt-6 space-y-4">
              <div
                v-for="item in routePreview"
                :key="item.question"
                class="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <p class="text-sm font-semibold text-gray-800 dark:text-white/90">{{ item.question }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    Intent: {{ item.intent }}
                  </span>
                  <span class="rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:bg-success-500/10 dark:text-success-300">
                    Action: {{ item.action }}
                  </span>
                </div>
                <p class="mt-3 text-sm text-gray-600 dark:text-gray-300">{{ item.reason }}</p>
              </div>
            </div>
          </section>
        </section>

        <section class="space-y-6">
          <section class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Sample Payload</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Payload ini adalah bentuk final template yang akan diwariskan ke tenant yang memilihnya.
                </p>
              </div>
              <Button variant="outline" size="sm" :disabled="copyingPayload" @click="copyPayload">
                {{ copyingPayload ? 'Copying...' : 'Copy JSON' }}
              </Button>
            </div>

            <pre class="json-preview">{{ payloadPreview }}</pre>
          </section>

          <section class="rounded-3xl border border-dashed border-warning-200 bg-warning-50 p-6 dark:border-warning-500/30 dark:bg-warning-500/5">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Core Engine Direction</h3>
            <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
              Template ini menegaskan bahwa engine baru tidak lagi bergantung pada konsep spesifik seperti `sales stage`, `vehicleType`, `packageName`, atau field hardcoded lain. Tenant cukup
              memilih template dan, bila nanti perlu, menambahkan override terkontrol.
            </p>
          </section>
        </section>
      </div>

      <section
        v-else-if="activeTab === 'advanced'"
        class="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Advanced</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Area ini menjadi bagian dari template. Nilainya ikut diwariskan ke tenant yang memakai template ini.
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <Button :disabled="savingTemplate || loadingTemplate" @click="saveTemplate">
              {{ savingTemplate ? 'Saving...' : isEditing ? 'Update Template' : 'Create Template' }}
            </Button>
            <Button variant="outline" :disabled="loadingTemplate" @click="restoreAdvancedDefaults">
              Restore Example Defaults
            </Button>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div class="space-y-4">
            <div>
              <label class="form-label">System Prompt</label>
              <textarea v-model="draft.advanced.systemPrompt" class="form-textarea min-h-[220px]" />
            </div>
            <div>
              <label class="form-label">Payment Prompt</label>
              <textarea v-model="draft.advanced.paymentPrompt" class="form-textarea min-h-[140px]" />
            </div>
          </div>

          <div class="space-y-5">
            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <div class="flex items-center justify-between gap-4">
                <label class="form-label mb-0">Score Threshold</label>
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ Number(draft.advanced.scoreThreshold).toFixed(2) }}</span>
              </div>
              <input v-model.number="draft.advanced.scoreThreshold" type="range" min="0.1" max="0.95" step="0.01" class="mt-3 w-full" />
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Lebih tinggi berarti retrieval lebih ketat dan fallback lebih sering.</p>
            </div>

            <div class="grid grid-cols-1 gap-4">
              <div>
                <label class="form-label">Top K</label>
                <input v-model.number="draft.advanced.topK" type="number" class="form-input" min="1" max="12" />
              </div>
              <div>
                <label class="form-label">Max Chunks</label>
                <input v-model.number="draft.advanced.maxChunks" type="number" class="form-input" min="1" max="8" />
              </div>
              <div>
                <label class="form-label">Chunk Target Tokens</label>
                <input v-model.number="draft.advanced.chunkTargetTokens" type="number" class="form-input" min="200" max="1500" />
              </div>
            </div>

            <div class="rounded-2xl border border-dashed border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950/40">
              <p class="text-xs uppercase tracking-wide text-gray-500">Template Notes</p>
              <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
                <li>Nilai advanced di sini tersimpan sebagai bagian dari template.</li>
                <li>Tenant yang memilih template akan mewarisi retrieval defaults ini.</li>
                <li>Jika nanti ada tenant override, nilainya bisa diubah terpisah tanpa merusak template asli.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import { apiFetch } from '@/lib/api'

type ActionType =
  | 'answer_from_knowledge'
  | 'collect_fields'
  | 'handoff_admin'
  | 'send_payment_info'
  | 'send_custom_message'

type FieldType = 'text' | 'phone' | 'date' | 'select' | 'textarea'

type AssistantFlowDraft = {
  profile: {
    assistantName: string
    businessContext: string
    greetingMessage: string
    clarifyMessage: string
    fallbackMessage: string
    thanksMessage: string
    menuEnabled: boolean
    menuItems: Array<{
      id: string
      label: string
      prompt: string
    }>
  }
  intents: Array<{
    id: string
    key: string
    label: string
    keywords: string[]
    searchHints: string[]
    defaultAction: string | null
  }>
  fields: Array<{
    id: string
    key: string
    label: string
    type: FieldType
    required: boolean
    placeholder: string
    helpText: string
    options?: string[]
  }>
  actions: Array<{
    id: string
    key: string
    type: ActionType
    label: string
    messageTemplate?: string
    fieldKeys?: string[]
  }>
  routingRules: Array<{
    id: string
    intentKey: string
    actionKey: string
    ifMissingFields?: string[]
    ifConfidenceBelow?: number | null
  }>
  advanced: {
    systemPrompt: string
    paymentPrompt: string
    scoreThreshold: number
    topK: number
    maxChunks: number
    chunkTargetTokens: number
  }
}

type AssistantTemplateItem = {
  id: number
  name: string
  slug: string
  description: string
  isSystem: boolean
  updatedAt: string
  assistantFlow: AssistantFlowDraft
}

const actionTypeOptions: ActionType[] = [
  'answer_from_knowledge',
  'collect_fields',
  'handoff_admin',
  'send_payment_info',
  'send_custom_message',
]

const fieldTypeOptions: FieldType[] = ['text', 'phone', 'date', 'select', 'textarea']

const route = useRoute()
const router = useRouter()
const activeTab = ref<'profile' | 'intents' | 'fields' | 'actions' | 'routing' | 'preview' | 'advanced'>('profile')
const tabs = [
  { id: 'profile', label: 'Profile' },
  { id: 'intents', label: 'Intents' },
  { id: 'fields', label: 'Fields' },
  { id: 'actions', label: 'Actions' },
  { id: 'routing', label: 'Routing' },
  { id: 'preview', label: 'Preview' },
  { id: 'advanced', label: 'Advanced' },
] as const

const loadingTemplate = ref(false)
const savingTemplate = ref(false)
const copyingPayload = ref(false)
const flashMessage = ref('')
const flashKind = ref<'success' | 'error' | 'info'>('info')
const templates = ref<AssistantTemplateItem[]>([])
const baselineDraft = ref<AssistantFlowDraft>(createSeedDraft())
const exampleDraft = ref<AssistantFlowDraft>(createSeedDraft())

const templateMeta = reactive({
  id: 0,
  slug: '',
  updatedAt: 'Belum pernah disimpan',
  isSystem: false,
})

const templateForm = reactive({
  name: '',
  description: '',
})

const draft = reactive<AssistantFlowDraft>(createSeedDraft())
const isEditing = computed(() => Number(route.params.id || 0) > 0)

const flashClass = computed(() => {
  if (flashKind.value === 'success') return 'text-success-600 dark:text-success-400'
  if (flashKind.value === 'error') return 'text-error-600 dark:text-error-400'
  return 'text-brand-700 dark:text-brand-300'
})

const payloadPreview = computed(() => JSON.stringify(buildAssistantPayload(), null, 2))
const requiredFieldsCount = computed(() => draft.fields.filter((field) => field.required).length)
const mappedIntentCount = computed(() =>
  draft.routingRules.filter((rule) => rule.intentKey && rule.actionKey).length,
)
const collectActionCount = computed(() =>
  draft.actions.filter((action) => action.type === 'collect_fields').length,
)

const routePreview = computed(() => {
  const samples = ['berapa harga layanan?', 'saya mau daftar', 'saya ingin bicara admin']
  return samples.map((question) => {
    const intent = detectIntent(question)
    const routeRule = intent ? draft.routingRules.find((rule) => rule.intentKey === intent.key && rule.actionKey) : null
    const actionKey = routeRule?.actionKey || intent?.defaultAction || draft.actions[0]?.key || ''
    const action = draft.actions.find((item) => item.key === actionKey)

    if (!intent) {
      return {
        question,
        intent: 'Tidak terdeteksi',
        action: action?.label || action?.key || 'Perlu clarify/fallback',
        reason: 'Belum ada keyword intent yang cocok, sehingga template ini masih akan jatuh ke clarify, fallback, atau knowledge action default.',
      }
    }

    const extras: string[] = []
    if (routeRule?.ifMissingFields?.length) extras.push(`cek field: ${routeRule.ifMissingFields.join(', ')}`)
    if (routeRule?.ifConfidenceBelow != null) extras.push(`confidence < ${routeRule.ifConfidenceBelow}`)

    return {
      question,
      intent: intent.label || intent.key,
      action: action?.label || action?.key || 'Belum ada action',
      reason: extras.length
        ? `Rule ditemukan untuk intent ${intent.key} dengan kondisi ${extras.join(' dan ')}.`
        : `Rule sederhana memetakan intent ${intent.key} ke action ${action?.key || 'yang dipilih'}.`,
    }
  })
})

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createSeedDraft(): AssistantFlowDraft {
  return {
    profile: {
      assistantName: 'Nara Assistant',
      businessContext: 'asisten WhatsApp untuk konsultasi layanan, pemesanan, dan follow up pelanggan',
      greetingMessage: 'Halo kak, saya siap bantu. Boleh pilih kebutuhan kakak atau langsung kirim pertanyaannya ya.',
      clarifyMessage: 'Siap kak, supaya saya bantu lebih tepat, boleh dijelaskan sedikit kebutuhan utamanya?',
      fallbackMessage: 'Maaf kak, saya belum menemukan jawaban yang cukup yakin dari data aktif. Boleh dijelaskan sedikit lebih detail?',
      thanksMessage: 'Sama-sama kak. Kalau masih ada yang ingin ditanyakan, saya siap bantu lagi ya.',
      menuEnabled: true,
      menuItems: [
        { id: createId('menu'), label: 'Tanya harga', prompt: 'tolong tampilkan harga layanan yang tersedia' },
        { id: createId('menu'), label: 'Mau reservasi', prompt: 'saya ingin reservasi atau booking layanan' },
      ],
    },
    intents: [
      {
        id: createId('intent'),
        key: 'pricing',
        label: 'Pricing Inquiry',
        keywords: ['harga', 'biaya', 'tarif'],
        searchHints: ['harga layanan', 'biaya paket', 'promo'],
        defaultAction: 'answer_pricing',
      },
      {
        id: createId('intent'),
        key: 'booking',
        label: 'Booking Request',
        keywords: ['booking', 'reservasi', 'jadwal', 'daftar'],
        searchHints: ['cara booking', 'jadwal tersedia', 'alur reservasi'],
        defaultAction: 'collect_booking',
      },
      {
        id: createId('intent'),
        key: 'contact_admin',
        label: 'Admin Handoff',
        keywords: ['admin', 'operator', 'hubungi', 'telepon'],
        searchHints: ['kontak admin', 'hubungi operator'],
        defaultAction: 'handoff_admin_now',
      },
    ],
    fields: [
      { id: createId('field'), key: 'full_name', label: 'Nama Lengkap', type: 'text', required: true, placeholder: 'Tulis nama lengkap', helpText: 'Dipakai untuk identifikasi pelanggan.' },
      { id: createId('field'), key: 'phone', label: 'Nomor WhatsApp', type: 'phone', required: true, placeholder: '08xxxxxxxxxx', helpText: 'Bisa dipakai untuk follow up manual.' },
      { id: createId('field'), key: 'service_type', label: 'Jenis Layanan', type: 'select', required: false, placeholder: '', helpText: 'Pilih kategori layanan yang diinginkan.', options: ['Basic Consultation', 'Premium Session', 'Home Visit'] },
      { id: createId('field'), key: 'preferred_date', label: 'Tanggal Pilihan', type: 'date', required: false, placeholder: '', helpText: 'Untuk kebutuhan reservasi atau booking.' },
    ],
    actions: [
      { id: createId('action'), key: 'answer_pricing', type: 'answer_from_knowledge', label: 'Answer Pricing from Knowledge', messageTemplate: 'Saya bantu cek informasi harga dari knowledge yang aktif ya kak.' },
      { id: createId('action'), key: 'collect_booking', type: 'collect_fields', label: 'Collect Booking Data', messageTemplate: 'Siap kak, sebelum lanjut booking saya bantu catat dulu beberapa data penting.', fieldKeys: ['full_name', 'phone', 'preferred_date'] },
      { id: createId('action'), key: 'handoff_admin_now', type: 'handoff_admin', label: 'Handoff to Admin', messageTemplate: 'Baik kak, saya bantu arahkan ke admin agar bisa lanjut ditangani langsung.' },
      { id: createId('action'), key: 'send_payment_guide', type: 'send_payment_info', label: 'Send Payment Guide', messageTemplate: 'Saya bantu kirim arahan pembayaran yang berlaku ya kak.' },
      { id: createId('action'), key: 'send_custom_followup', type: 'send_custom_message', label: 'Custom Follow Up Message', messageTemplate: 'Kalau kakak berkenan, saya bisa bantu arahkan ke langkah berikutnya sesuai kebutuhan kakak.' },
    ],
    routingRules: [
      { id: createId('rule'), intentKey: 'pricing', actionKey: 'answer_pricing', ifConfidenceBelow: 0.45 },
      { id: createId('rule'), intentKey: 'booking', actionKey: 'collect_booking', ifMissingFields: ['full_name', 'phone'] },
      { id: createId('rule'), intentKey: 'contact_admin', actionKey: 'handoff_admin_now' },
    ],
    advanced: {
      systemPrompt: '',
      paymentPrompt: '',
      scoreThreshold: 0.45,
      topK: 5,
      maxChunks: 3,
      chunkTargetTokens: 700,
    },
  }
}

function assignDraft(next: AssistantFlowDraft) {
  Object.assign(draft.profile, deepClone(next.profile))
  Object.assign(draft.advanced, deepClone(next.advanced))
  draft.intents.splice(0, draft.intents.length, ...deepClone(next.intents))
  draft.fields.splice(0, draft.fields.length, ...deepClone(next.fields))
  draft.actions.splice(0, draft.actions.length, ...deepClone(next.actions))
  draft.routingRules.splice(0, draft.routingRules.length, ...deepClone(next.routingRules))
}

function clearMessages() {
  flashMessage.value = ''
}

function setFlash(kind: 'success' | 'error' | 'info', message: string) {
  flashKind.value = kind
  flashMessage.value = message
}

function formatUpdatedAt(value: string | null) {
  if (!value) return 'Belum pernah disimpan'
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function toCsv(values: string[]) {
  return values.join(', ')
}

function parseCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function setStringList(target: { keywords?: string[]; searchHints?: string[] }, key: 'keywords' | 'searchHints', event: Event) {
  target[key] = parseCsv((event.target as HTMLTextAreaElement).value)
}

function setFieldOptions(field: AssistantFlowDraft['fields'][number], event: Event) {
  field.options = parseCsv((event.target as HTMLTextAreaElement).value)
}

function setActionFields(action: AssistantFlowDraft['actions'][number], event: Event) {
  action.fieldKeys = parseCsv((event.target as HTMLTextAreaElement).value)
}

function setRoutingMissingFields(rule: AssistantFlowDraft['routingRules'][number], event: Event) {
  rule.ifMissingFields = parseCsv((event.target as HTMLTextAreaElement).value)
}

function buildAssistantPayload() {
  return deepClone({
    profile: draft.profile,
    intents: draft.intents,
    fields: draft.fields,
    actions: draft.actions,
    routingRules: draft.routingRules,
    advanced: draft.advanced,
  })
}

function buildTemplatePayload() {
  return {
    name: templateForm.name.trim(),
    description: templateForm.description.trim(),
    assistantFlow: buildAssistantPayload(),
  }
}

function detectIntent(question: string) {
  const lower = question.toLowerCase()
  const scored = draft.intents
    .map((intent) => ({
      intent,
      score: intent.keywords.reduce((count, keyword) => (lower.includes(keyword.toLowerCase()) ? count + 1 : count), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.intent || null
}

function applyTemplate(template: AssistantTemplateItem) {
  templateMeta.id = template.id
  templateMeta.slug = template.slug
  templateMeta.updatedAt = formatUpdatedAt(template.updatedAt)
  templateMeta.isSystem = template.isSystem
  templateForm.name = template.name
  templateForm.description = template.description || ''
  baselineDraft.value = deepClone(template.assistantFlow)
  exampleDraft.value = deepClone(template.assistantFlow)
  assignDraft(template.assistantFlow)
}

async function loadTemplates() {
  templates.value = await apiFetch<AssistantTemplateItem[]>('/rag-config/templates')
}

async function loadCurrentTemplate() {
  loadingTemplate.value = true
  clearMessages()

  try {
    await loadTemplates()
    if (templates.value.length) {
      exampleDraft.value = deepClone(templates.value[0].assistantFlow)
    }

    if (!isEditing.value) {
      templateMeta.id = 0
      templateMeta.slug = ''
      templateMeta.updatedAt = 'Belum pernah disimpan'
      templateMeta.isSystem = false
      templateForm.name = ''
      templateForm.description = ''
      baselineDraft.value = deepClone(exampleDraft.value)
      assignDraft(exampleDraft.value)
      setFlash('info', 'Editor template siap dipakai. Isi metadata template lalu simpan saat sudah siap.')
      return
    }

    const id = Number(route.params.id || 0)
    const selected = templates.value.find((item) => item.id === id)
    if (!selected) {
      setFlash('error', 'Template tidak ditemukan.')
      return
    }

    applyTemplate(selected)
    setFlash('info', `Template ${selected.name} berhasil dimuat untuk diedit.`)
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : 'Gagal memuat template')
  } finally {
    loadingTemplate.value = false
  }
}

function loadExample() {
  clearMessages()
  assignDraft(exampleDraft.value)
  setFlash('info', 'Draft diganti ke example template yang sedang dipakai sebagai baseline.')
}

function resetDraft() {
  clearMessages()
  assignDraft(baselineDraft.value)
  setFlash('info', 'Draft dikembalikan ke baseline template terakhir yang dimuat.')
}

async function copyPayload() {
  copyingPayload.value = true
  clearMessages()

  try {
    await navigator.clipboard.writeText(payloadPreview.value)
    setFlash('success', 'Payload template berhasil disalin.')
  } catch {
    setFlash('error', 'Clipboard tidak tersedia. Salin payload langsung dari tab Preview.')
  } finally {
    copyingPayload.value = false
  }
}

async function saveTemplate() {
  if (!templateForm.name.trim()) {
    setFlash('error', 'Nama template wajib diisi sebelum menyimpan.')
    return
  }

  savingTemplate.value = true
  clearMessages()

  try {
    const payload = buildTemplatePayload()
    const response = isEditing.value
      ? await apiFetch<AssistantTemplateItem>(`/rag-config/templates/${Number(route.params.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      : await apiFetch<AssistantTemplateItem>('/rag-config/templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

    applyTemplate(response)

    if (!isEditing.value) {
      await router.replace(`/ai-settings/rag-config/${response.id}/edit`)
    }

    setFlash('success', isEditing.value ? 'Template berhasil diperbarui.' : 'Template baru berhasil dibuat.')
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : 'Gagal menyimpan template')
  } finally {
    savingTemplate.value = false
  }
}

function restoreAdvancedDefaults() {
  clearMessages()
  Object.assign(draft.advanced, deepClone(exampleDraft.value.advanced))
  setFlash('info', 'Advanced settings dikembalikan ke baseline example template.')
}

function reloadTemplate() {
  void loadCurrentTemplate()
}

function backToTemplates() {
  router.push('/ai-settings/rag-config')
}

function addMenuItem() {
  draft.profile.menuItems.push({ id: createId('menu'), label: '', prompt: '' })
}

function removeMenuItem(index: number) {
  draft.profile.menuItems.splice(index, 1)
}

function addIntent() {
  draft.intents.push({ id: createId('intent'), key: '', label: '', keywords: [], searchHints: [], defaultAction: null })
}

function removeIntent(index: number) {
  draft.intents.splice(index, 1)
}

function addField() {
  draft.fields.push({ id: createId('field'), key: '', label: '', type: 'text', required: false, placeholder: '', helpText: '', options: [] })
}

function removeField(index: number) {
  draft.fields.splice(index, 1)
}

function addAction() {
  draft.actions.push({ id: createId('action'), key: '', type: 'send_custom_message', label: '', messageTemplate: '', fieldKeys: [] })
}

function removeAction(index: number) {
  draft.actions.splice(index, 1)
}

function addRoutingRule() {
  draft.routingRules.push({ id: createId('rule'), intentKey: '', actionKey: '', ifMissingFields: [], ifConfidenceBelow: null })
}

function removeRoutingRule(index: number) {
  draft.routingRules.splice(index, 1)
}

onMounted(() => {
  void loadCurrentTemplate()
})

watch(
  () => route.params.id,
  (next, previous) => {
    if (next === previous) return
    void loadCurrentTemplate()
  },
)
</script>

<style scoped>
input[type='range'] {
  accent-color: #465fff;
}

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

.form-input,
.form-textarea {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid rgb(209 213 219);
  background: transparent;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgb(31 41 55);
  outline: none;
}

.form-input:focus,
.form-textarea:focus {
  border-color: rgb(70 95 255);
}

.dark .form-input,
.dark .form-textarea {
  border-color: rgb(55 65 81);
  color: rgb(255 255 255 / 0.9);
}

.ghost-btn {
  border: 0;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.summary-card {
  border-radius: 1rem;
  border: 1px solid rgb(229 231 235);
  background: rgb(249 250 251);
  padding: 1rem;
}

.dark .summary-card {
  border-color: rgb(31 41 55);
  background: rgb(17 24 39);
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(107 114 128);
}

.summary-value {
  margin-top: 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: rgb(31 41 55);
}

.dark .summary-value {
  color: rgb(255 255 255 / 0.92);
}

.json-preview {
  margin-top: 1.5rem;
  max-height: 640px;
  overflow: auto;
  border-radius: 1rem;
  border: 1px solid rgb(229 231 235);
  background: rgb(17 24 39);
  padding: 1rem;
  font-size: 0.8rem;
  line-height: 1.6;
  color: rgb(226 232 240);
}
</style>
