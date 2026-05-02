<template>
  <admin-layout>
    <PageBreadcrumb pageTitle="Latih AI WhatsApp" />

    <div class="space-y-6">
      <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="text-xl font-semibold text-gray-800 dark:text-white/90">Latih AI WhatsApp</h3>
              <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                Wizard Tenant
              </span>
              <span v-if="targetTenantId" class="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                Tenant #{{ targetTenantId }}
              </span>
            </div>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              Pandu AI memahami bisnis, pengetahuan penting, dan cara menjawab pelanggan di WhatsApp tanpa membuka pengaturan teknis.
              <span v-if="targetTenantId">Mode ini dibuka dari Manage Tenant dan disiapkan untuk konteks tenant target.</span>
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <Button variant="outline" :loading="loading" :disabled="saving" @click="loadData">
              {{ loading ? 'Memuat...' : 'Refresh' }}
            </Button>
            <Button variant="outline" :loading="saving" :disabled="loading" @click="saveDraft">
              {{ saving ? 'Menyimpan...' : 'Simpan Draft' }}
            </Button>
          </div>
        </div>

        <p v-if="flashMessage" :class="['mt-4 text-sm', flashClass]">{{ flashMessage }}</p>
      </section>

      <section class="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="grid grid-cols-1 gap-2 md:grid-cols-4">
          <button
            v-for="(step, index) in steps"
            :key="step.id"
            type="button"
            :class="[
              'step-button',
              activeStep === index
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900',
            ]"
            @click="activeStep = index"
          >
            <span
              :class="[
                'step-number',
                activeStep === index ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300',
              ]"
            >
              {{ index + 1 }}
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold">{{ step.label }}</span>
              <span class="block truncate text-xs opacity-75">{{ step.description }}</span>
            </span>
          </button>
        </div>
      </section>

      <section v-if="loading" class="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
        Memuat data pelatihan AI...
      </section>

      <template v-else>
        <section v-if="activeStep === 0" class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="flex flex-col gap-2">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Info Bisnis</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Isi konteks dasar supaya AI tahu sedang mewakili bisnis apa dan harus bicara seperti apa.</p>
          </div>

          <div class="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div>
              <label class="form-label">Nama Bisnis</label>
              <input v-model="profileForm.businessName" class="form-input" placeholder="Contoh: Redo Kursus Mobil" />
            </div>
            <div>
              <label class="form-label">Nama AI</label>
              <input v-model="profileForm.assistantName" class="form-input" placeholder="Contoh: Admin Redo" />
            </div>
            <div class="xl:col-span-2">
              <label class="form-label">Bisnis ini melayani apa?</label>
              <textarea
                v-model="profileForm.businessContext"
                class="form-textarea"
                rows="4"
                placeholder="Contoh: kursus mengemudi mobil manual dan matic untuk pemula, latihan parkir, dan persiapan ujian SIM."
              />
            </div>
            <div>
              <label class="form-label">Sapaan Awal</label>
              <textarea v-model="profileForm.greetingMessage" class="form-textarea" rows="3" />
            </div>
            <div>
              <label class="form-label">Pertanyaan Saat Maksud Belum Jelas</label>
              <textarea
                v-model="profileForm.clarifyMessage"
                class="form-textarea"
                rows="3"
                placeholder="Contoh: Siap kak, boleh dijelaskan sedikit lebih detail kebutuhan kakak?"
              />
            </div>
            <div>
              <label class="form-label">Jawaban Saat AI Belum Tahu</label>
              <textarea v-model="profileForm.fallbackMessage" class="form-textarea" rows="3" />
            </div>
          </div>
        </section>

        <section v-else-if="activeStep === 1" class="space-y-5">
          <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div>
              <div>
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Ajarkan Pengetahuan</h3>
                <p class="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                  Isi data inti yang paling sering ditanyakan pelanggan, lalu lengkapi topik lain langsung di step ini bila dibutuhkan.
                </p>
              </div>
            </div>

            <div class="mt-5">
              <label class="form-label">Kalimat Pengantar Saat Menjawab dari Pengetahuan</label>
              <textarea
                v-model="formatForm.answerPrefix"
                class="form-textarea"
                rows="3"
                placeholder="Contoh: Saya bantu cek informasinya ya kak."
              />
              <p class="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                Kalimat ini dipakai sebagai pembuka saat AI menjawab dari data pengetahuan aktif.
              </p>
            </div>
          </section>

          <section
            v-if="leadQuestion"
            class="rounded-2xl border border-warning-200 bg-warning-50 p-5 dark:border-warning-500/30 dark:bg-warning-500/10"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p class="text-sm font-semibold text-warning-800 dark:text-warning-200">Pertanyaan dari lead fallback</p>
                <p class="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">{{ leadQuestion }}</p>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {{ leadMetaLabel }}
                </p>
              </div>
              <Button size="sm" variant="outline" @click="addLeadQuestionKnowledge">
                Jadikan Pengetahuan
              </Button>
            </div>
          </section>

          <section class="space-y-4">
            <div>
              <h4 class="text-base font-semibold text-gray-800 dark:text-white/90">Pengetahuan Utama</h4>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Tiga bagian ini biasanya paling sering ditanyakan pelanggan.</p>
            </div>
            <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <section
                v-for="section in primaryKnowledgeSections"
                :key="section.key"
                class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h4 class="font-semibold text-gray-800 dark:text-white/90">{{ section.title }}</h4>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ section.help }}</p>
                  </div>
                  <span class="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    Utama
                  </span>
                </div>
                <textarea
                  v-model="section.content"
                  class="form-textarea mt-4 min-h-[180px]"
                  :placeholder="section.placeholder"
                />
              </section>
            </div>
          </section>

          <section class="space-y-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 class="text-base font-semibold text-gray-800 dark:text-white/90">Topik Sendiri</h4>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Tambahkan info lain sesuai kebutuhan bisnis, misalnya alur booking khusus, jam layanan, lokasi, pembayaran, kebijakan, promo, atau cabang.</p>
              </div>
              <Button variant="outline" size="sm" @click="addCustomKnowledge">Tambah Topik Sendiri</Button>
            </div>

            <p v-if="!customKnowledgeSections.length" class="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
              Belum ada topik sendiri. Gunakan tombol tambah kalau ada info khusus yang belum masuk ke form di atas.
            </p>

            <section
              v-for="(section, index) in customKnowledgeSections"
              :key="section.key"
              class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <label class="form-label">Judul Topik</label>
                  <input v-model="section.title" class="form-input" placeholder="Contoh: Promo Bulan Ini" />
                </div>
                <button type="button" class="ghost-btn text-error-600 dark:text-error-400" @click="removeCustomKnowledge(index)">Hapus</button>
              </div>
              <label class="form-label mt-4">Isi Topik</label>
              <textarea
                v-model="section.content"
                class="form-textarea mt-4 min-h-[180px]"
                placeholder="Tulis info tambahan yang perlu diketahui AI. Buat jelas dan faktual agar jawaban bot tidak menebak."
              />
            </section>
          </section>
        </section>

        <section v-else-if="activeStep === 2" class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Format Jawaban WhatsApp</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Pilih cara AI menyusun jawaban. Pengaturan teknis tetap disembunyikan.</p>
            </div>

            <div class="mt-6">
              <label class="form-label">Pilih Mode Format</label>
              <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <button
                  type="button"
                  :class="[
                    'format-mode-card',
                    !formatForm.advancedEnabled
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-gray-900',
                  ]"
                  @click="formatForm.advancedEnabled = false"
                >
                  <span class="flex items-start justify-between gap-3">
                    <span class="text-sm font-semibold">Pakai Template</span>
                    <span :class="['format-mode-badge', !formatForm.advancedEnabled ? 'format-mode-badge-active' : 'format-mode-badge-idle']">
                      {{ !formatForm.advancedEnabled ? 'Aktif' : 'Tidak aktif' }}
                    </span>
                  </span>
                  <span class="mt-1 block text-sm opacity-75">Pilih gaya, panjang, struktur, dan CTA dari opsi yang sudah disediakan.</span>
                </button>
                <button
                  type="button"
                  :class="[
                    'format-mode-card',
                    formatForm.advancedEnabled
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-gray-900',
                  ]"
                  @click="formatForm.advancedEnabled = true"
                >
                  <span class="flex items-start justify-between gap-3">
                    <span class="text-sm font-semibold">Custom Override</span>
                    <span :class="['format-mode-badge', formatForm.advancedEnabled ? 'format-mode-badge-active' : 'format-mode-badge-idle']">
                      {{ formatForm.advancedEnabled ? 'Aktif' : 'Tidak aktif' }}
                    </span>
                  </span>
                  <span class="mt-1 block text-sm opacity-75">Tulis format sendiri. Instruksi ini akan diprioritaskan atas template step 3.</span>
                </button>
              </div>
            </div>

            <section v-if="!formatForm.advancedEnabled" class="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <h4 class="font-semibold text-gray-800 dark:text-white/90">Aturan Aktif: Template</h4>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">AI akan memakai pilihan template di bawah ini. Instruksi custom tidak dipakai selama mode ini aktif.</p>
              </div>

              <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <label class="form-label">Panjang Jawaban</label>
                  <select v-model="formatForm.length" class="form-input">
                    <option value="short">Singkat dan langsung</option>
                    <option value="medium">Sedang dengan poin penting</option>
                    <option value="complete">Lengkap tapi tetap rapi</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">Gaya Bahasa</label>
                  <select v-model="formatForm.tone" class="form-input">
                    <option value="friendly">Ramah seperti admin WA</option>
                    <option value="professional">Profesional dan rapi</option>
                    <option value="casual">Santai dan dekat</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">Struktur Jawaban</label>
                  <select v-model="formatForm.structure" class="form-input">
                    <option value="opening_details_cta">Pembuka, isi, ajakan lanjut</option>
                    <option value="direct_bullets_cta">Langsung ke poin, lalu ajakan lanjut</option>
                    <option value="summary_steps_cta">Ringkasan, langkah, ajakan lanjut</option>
                  </select>
                </div>
                <div>
                  <label class="form-label">CTA Penutup</label>
                  <select v-model="formatForm.ctaStyle" class="form-input">
                    <option value="ask_need">Tanya kebutuhan pelanggan</option>
                    <option value="invite_booking">Ajak booking/daftar</option>
                    <option value="offer_admin">Tawarkan bantuan admin</option>
                  </select>
                </div>
              </div>
            </section>

            <section v-else class="mt-5 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
              <div>
                <h4 class="font-semibold text-gray-800 dark:text-white/90">Aturan Aktif: Custom Override</h4>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  AI akan memakai instruksi custom ini sebagai prioritas. Pilihan template tetap tersimpan, tetapi tidak dipakai selama mode ini aktif.
                </p>
              </div>

              <div class="mt-4">
                <label class="form-label">Instruksi Format Custom</label>
                <textarea
                  v-model="formatForm.customInstruction"
                  class="form-textarea min-h-[170px]"
                  placeholder="Contoh: Jawab dengan urutan: sapaan singkat, jawaban utama dari knowledge, rekomendasi singkat jika relevan, lalu tanya apakah pelanggan ingin dibantu booking. Jangan pakai emoji dan jangan terlalu panjang."
                />
              </div>
            </section>

            <section class="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 class="font-semibold text-gray-800 dark:text-white/90">Aturan Jawaban Tambahan</h4>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Tambahkan aturan ringan sesuai karakter bisnis. Aturan ini tetap dibatasi agar AI tidak mengarang di luar knowledge.
                  </p>
                </div>
                <Button variant="outline" size="sm" @click="addAnswerRule">Tambah Aturan</Button>
              </div>

              <div class="mt-4 space-y-3">
                <p v-if="!formatForm.customRules.length" class="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/40 dark:text-gray-400">
                  Belum ada aturan tambahan. Contoh: jangan menjanjikan hasil pasti, jangan pakai emoji, atau selalu tanya jadwal pilihan.
                </p>
                <div
                  v-for="(rule, index) in formatForm.customRules"
                  :key="rule.id"
                  class="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-950/40 sm:flex-row sm:items-center"
                >
                  <input
                    v-model="rule.text"
                    class="form-input"
                    placeholder="Contoh: Jangan pernah menjanjikan hasil pasti."
                  />
                  <button type="button" class="ghost-btn text-error-600 dark:text-error-400" @click="removeAnswerRule(index)">Hapus</button>
                </div>
              </div>
            </section>

            <p class="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
              Mode aktif: <span class="font-semibold text-gray-700 dark:text-gray-200">{{ formatForm.advancedEnabled ? 'Custom Override' : 'Pakai Template' }}</span>.
              Simpan step ini agar format tersebut dipakai oleh AI live.
            </p>
          </section>

          <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Preview Bubble</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Contoh tampilan jawaban yang akan diarahkan ke AI.</p>

            <div class="mt-5 rounded-2xl bg-gray-100 p-4 dark:bg-gray-900">
              <div class="wa-bubble">
                <p class="whitespace-pre-line">{{ sampleAnswer }}</p>
                <span class="mt-3 block text-right text-[11px] text-gray-400">09.41</span>
              </div>
            </div>

            <div v-if="activeFormatNotes.length" class="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-gray-800">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Aturan aktif</p>
              <ul class="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li v-for="note in activeFormatNotes" :key="note" class="flex gap-2">
                  <span class="mt-2 size-1.5 flex-shrink-0 rounded-full bg-brand-500"></span>
                  <span>{{ note }}</span>
                </li>
              </ul>
            </div>
          </section>
        </section>

        <section v-else class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div>
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Simulasi Chat</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Coba pertanyaan pelanggan dan lihat jawaban AI dari knowledge aktif.</p>
            </div>

            <div class="mt-6">
              <label class="form-label">Pertanyaan pelanggan</label>
              <textarea
                v-model="testQuestion"
                class="form-textarea"
                rows="5"
                placeholder="Contoh: Kak, harga paket kursus mobil matic berapa?"
              />
            </div>

            <div class="mt-4 flex flex-wrap gap-3">
              <Button :loading="testing" :disabled="saving || !testQuestion.trim()" @click="runPreview">
                {{ testing ? 'Mencoba...' : simulationMessages.length ? 'Kirim ke Simulasi' : 'Coba Jawaban AI' }}
              </Button>
              <Button variant="outline" :disabled="testing || !simulationMessages.length" @click="resetSimulation">Reset Simulasi</Button>
              <Button variant="outline" @click="activeStep = 1">Perbaiki Pengetahuan</Button>
              <Button variant="outline" @click="activeStep = 2">Ubah Format Jawaban</Button>
            </div>
          </section>

          <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div class="flex flex-col gap-2">
              <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Hasil Simulasi</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Jawaban ditampilkan seperti chat WhatsApp agar mudah dinilai.</p>
            </div>

            <div ref="simulationScrollEl" class="simulation-chat-scroll mt-5 rounded-2xl bg-gray-100 p-4 dark:bg-gray-900">
              <div v-if="simulationMessages.length" class="space-y-4">
                <div
                  v-for="message in simulationMessages"
                  :key="message.id"
                  class="flex"
                  :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
                >
                  <div :class="message.role === 'user' ? 'wa-user-bubble' : 'wa-bubble max-w-[92%]'">
                    <p class="whitespace-pre-line">{{ message.message }}</p>
                    <span class="mt-3 block text-right text-[11px] text-gray-400">
                      {{ message.role === 'user' ? 'Pelanggan' : 'AI Preview' }}
                    </span>
                  </div>
                </div>
              </div>
              <div v-else class="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/60 p-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950/30 dark:text-gray-400">
                Tulis pertanyaan pelanggan, lalu kirim untuk mulai simulasi percakapan.
              </div>

              <div v-if="previewMatches.length" class="mt-4 rounded-xl border border-white/80 bg-white p-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-400">
                <p class="font-semibold text-gray-700 dark:text-gray-200">Diambil dari pengetahuan aktif:</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <span v-for="match in previewMatches" :key="`${match.title}-${match.score}`" class="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                    {{ match.title }} ({{ match.score }})
                  </span>
                </div>
              </div>

              <div
                v-else-if="previewAnswer && !previewReindexHasError"
                class="mt-4 rounded-xl border border-warning-200 bg-warning-50 p-3 text-xs leading-5 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200"
              >
                AI belum menemukan potongan knowledge yang cocok untuk pertanyaan ini. Coba pakai pertanyaan yang lebih spesifik, atau tambahkan jawabannya di step Pengetahuan lalu simpan lagi.
              </div>

              <div
                v-if="previewReindexHasError"
                class="mt-4 rounded-xl border border-error-200 bg-error-50 p-3 text-xs leading-5 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-200"
              >
                Reindex knowledge belum berhasil, jadi simulasi production belum bisa memakai data terbaru. Periksa konfigurasi embedding/Qdrant lalu coba simpan atau simulasi lagi.
              </div>

              <div v-if="previewSearchQuery || previewDetectedIntents.length" class="mt-3 rounded-xl bg-white/80 p-3 text-xs text-gray-500 dark:bg-gray-950/50 dark:text-gray-400">
                <p v-if="previewSearchQuery"><span class="font-semibold">Query pencarian:</span> {{ previewSearchQuery }}</p>
                <p v-if="previewDetectedIntents.length" class="mt-1">
                  <span class="font-semibold">Intent:</span> {{ previewDetectedIntents.join(', ') }}
                </p>
              </div>
            </div>
          </section>
        </section>

        <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" :disabled="activeStep === 0 || saving" @click="activeStep = Math.max(0, activeStep - 1)">
              Kembali
            </Button>
            <div class="flex flex-wrap gap-3 sm:justify-end">
              <Button variant="outline" :loading="saving" @click="saveDraft">
                {{ saving ? 'Menyimpan...' : 'Simpan Draft' }}
              </Button>
              <Button :loading="saving" @click="saveAndNext">
                {{ activeStep === steps.length - 1 ? 'Simpan Semua' : 'Simpan & Lanjut' }}
              </Button>
            </div>
          </div>
        </section>
      </template>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import PageBreadcrumb from '@/components/common/PageBreadcrumb.vue'
import Button from '@/components/ui/Button.vue'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

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
    menuItems: Array<{ id: string; label: string; prompt: string }>
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
    trainingFormat?: {
      length?: 'short' | 'medium' | 'complete'
      tone?: 'friendly' | 'professional' | 'casual'
      structure?: 'opening_details_cta' | 'direct_bullets_cta' | 'summary_steps_cta'
      ctaStyle?: 'ask_need' | 'invite_booking' | 'offer_admin'
      answerPrefix?: string
      customRules?: string[]
      advancedEnabled?: boolean
      customInstruction?: string
    }
  }
}

type RagConfigResponse = {
  config: {
    assistantName: string
    businessContext: string
    greetingMessage: string
    clarifyMessage: string
    fallbackMessage: string
    thanksMessage: string
    systemPrompt: string
    paymentPrompt: string
    scoreThreshold: number
    topK: number
    maxChunks: number
    chunkTargetTokens: number
  }
  assistantFlow: AssistantFlowDraft
}

type KnowledgeArticle = {
  id: number
  title: string
  content: string
  status: string
}

type AiTrainingResponse = {
  profile: {
    businessName: string
    assistantName: string
    businessContext: string
    greetingMessage: string
    clarifyMessage: string
    fallbackMessage: string
  }
  format: typeof formatForm
  knowledgeSections: Array<KnowledgeSection & { id?: number | null; status?: string | null }>
  customKnowledgeSections: Array<CustomKnowledgeSection & { status?: string | null }>
}

type PreviewResult = {
  generatedAnswer: string
  topMatches: Array<{ title: string; score: number; snippet: string }>
  searchQuery?: string
  detectedIntents?: string[]
  reindex?: {
    ok: boolean
    results: Array<{ id?: number; status?: string; chunks?: number }>
  } | null
}

type SimulationMessage = {
  id: string
  role: 'user' | 'assistant'
  message: string
}

const auth = useAuth()
const route = useRoute()
const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const activeStep = ref(0)
const flashMessage = ref('')
const flashKind = ref<'success' | 'error' | 'info'>('info')
const currentFlow = ref<AssistantFlowDraft | null>(null)
const testQuestion = ref('')
const previewAnswer = ref('')
const previewMatches = ref<PreviewResult['topMatches']>([])
const previewSearchQuery = ref('')
const previewDetectedIntents = ref<string[]>([])
const previewReindexResults = ref<Array<{ id?: number; status?: string; chunks?: number }>>([])
const simulationMessages = ref<SimulationMessage[]>([])
const simulationScrollEl = ref<HTMLElement | null>(null)
const removedCustomKnowledgeIds = ref<number[]>([])
const targetTenantId = computed(() => {
  const raw = Number(route.query.tenantId || 0)
  return Number.isInteger(raw) && raw > 0 ? raw : null
})
const leadQuestion = computed(() => String(route.query.question || '').trim())
const leadReason = computed(() => String(route.query.reason || '').trim())
const leadPhone = computed(() => String(route.query.phone || '').trim())
const leadMetaLabel = computed(() => {
  const meta = []
  if (leadReason.value) meta.push(`Alasan: ${leadReason.value}`)
  if (leadPhone.value) meta.push(`Kontak: ${leadPhone.value}`)
  return meta.length ? meta.join(' | ') : 'Tambahkan jawabannya agar AI bisa menjawab kasus serupa.'
})

const previewReindexHasError = computed(() =>
  previewReindexResults.value.some((item) => item.status === 'error' || item.status === 'skipped_empty'),
)

const trainingQuery = computed(() => {
  return targetTenantId.value ? `?tenantId=${targetTenantId.value}` : ''
})

function trainingEndpoint(path = '') {
  return `/ai-training${path}${trainingQuery.value}`
}

const steps = [
  { id: 'profile', label: 'Info Bisnis', description: 'Identitas dan gaya' },
  { id: 'knowledge', label: 'Pengetahuan', description: 'Data yang diajarkan' },
  { id: 'format', label: 'Format WA', description: 'Cara bot menjawab' },
  { id: 'preview', label: 'Simulasi', description: 'Coba jawaban AI' },
]

const profileForm = reactive({
  businessName: '',
  assistantName: '',
  businessContext: '',
  greetingMessage: 'Halo kak, saya siap bantu. Silakan kirim pertanyaannya ya.',
  clarifyMessage: 'Siap kak, supaya lebih tepat saya bantu, boleh dijelaskan sedikit lebih detail kebutuhannya ya?',
  fallbackMessage: 'Maaf kak, saya belum menemukan jawaban yang pas dari data yang aktif. Boleh ditulis lebih detail?',
})

const formatForm = reactive({
  length: 'medium' as 'short' | 'medium' | 'complete',
  tone: 'friendly' as 'friendly' | 'professional' | 'casual',
  structure: 'opening_details_cta' as 'opening_details_cta' | 'direct_bullets_cta' | 'summary_steps_cta',
  ctaStyle: 'ask_need' as 'ask_need' | 'invite_booking' | 'offer_admin',
  answerPrefix: 'Saya bantu cek informasinya ya kak.',
  customRules: [] as Array<{ id: string; text: string }>,
  advancedEnabled: false,
  customInstruction: '',
})

type KnowledgeSection = {
  key: string
  id?: number | null
  title: string
  help: string
  content: string
  placeholder: string
  group: 'primary'
}

type CustomKnowledgeSection = {
  key: string
  id?: number
  title: string
  content: string
}

const knowledgeSections = reactive([
  {
    key: 'faq',
    title: 'FAQ Umum',
    help: 'Pertanyaan yang paling sering ditanyakan pelanggan.',
    content: '',
    placeholder: 'Contoh:\n- Apakah pemula bisa ikut?\nBisa, program tersedia untuk pemula.\n\n- Apakah bisa pilih jadwal?\nBisa, jadwal menyesuaikan ketersediaan instruktur.',
    group: 'primary',
  },
  {
    key: 'pricing',
    title: 'Harga dan Paket',
    help: 'Daftar paket, harga, durasi, promo, dan perbedaan tiap paket.',
    content: '',
    placeholder: 'Contoh:\nPaket Basic: Rp...\nPaket Regular: Rp...\nPaket Intensif: Rp...\n\nHarga dapat berubah sesuai promo yang sedang berlaku.',
    group: 'primary',
  },
  {
    key: 'booking',
    title: 'Cara Daftar atau Booking',
    help: 'Alur booking tiap bisnis, termasuk cara bayar bila memang bagian dari proses daftar.',
    content: '',
    placeholder: 'Contoh:\n1. Pilih paket yang diinginkan.\n2. Booking bisa lewat link website atau chat admin.\n3. Admin konfirmasi ketersediaan jadwal.\n4. Pembayaran dilakukan setelah admin mengonfirmasi paket dan jadwal.\n5. Admin akan mengirim instruksi pembayaran secara manual bila diperlukan.\n\nCatatan: bot tidak perlu meminta bukti transfer, screenshot, foto, atau lampiran.',
    group: 'primary',
  },
]) as KnowledgeSection[]

const customKnowledgeSections = reactive<CustomKnowledgeSection[]>([])

const primaryKnowledgeSections = computed(() => knowledgeSections.filter((section) => section.group === 'primary'))

const activeFormatNotes = computed(() => {
  const notes = formatForm.customRules.map((rule) => rule.text.trim()).filter(Boolean)
  if (formatForm.advancedEnabled && formatForm.customInstruction.trim()) {
    notes.push(`Instruksi khusus aktif: ${formatForm.customInstruction.trim()}`)
  }
  return notes.slice(0, 5)
})

const flashClass = computed(() => {
  if (flashKind.value === 'success') return 'text-success-600 dark:text-success-400'
  if (flashKind.value === 'error') return 'text-error-600 dark:text-error-400'
  return 'text-brand-700 dark:text-brand-300'
})

const sampleAnswer = computed(() => {
  const opening =
    formatForm.tone === 'professional'
      ? 'Baik, berikut informasi yang tersedia.'
      : formatForm.tone === 'casual'
        ? 'Siap kak, ini infonya ya.'
        : 'Siap kak, saya bantu jelaskan ya.'

  const details =
    formatForm.length === 'short'
      ? 'Paket tersedia sesuai kebutuhan pelanggan. Detail harga mengikuti paket yang dipilih.'
      : formatForm.length === 'complete'
        ? 'Paket tersedia dalam beberapa pilihan. Biasanya pelanggan bisa memilih berdasarkan durasi, jadwal, dan kebutuhan. Detail harga, fasilitas, dan ketentuan akan mengikuti data knowledge yang aktif.'
        : 'Paket tersedia dalam beberapa pilihan. AI akan mengambil harga, durasi, dan ketentuan dari knowledge aktif.'

  const cta =
    formatForm.ctaStyle === 'invite_booking'
      ? 'Kalau kakak cocok, saya bisa bantu lanjutkan proses booking.'
      : formatForm.ctaStyle === 'offer_admin'
        ? 'Kalau perlu, saya bisa bantu arahkan ke admin.'
        : 'Kalau kakak mau, saya bisa bantu pilihkan yang paling sesuai.'

  if (formatForm.structure === 'direct_bullets_cta') {
    return `${formatForm.answerPrefix}\n\n- ${details}\n- Jawaban dibuat singkat dan mudah dibaca.\n\n${cta}`
  }

  if (formatForm.structure === 'summary_steps_cta') {
    return `${opening}\n\nRingkasnya: ${details}\n\nLangkah berikutnya:\n1. Pilih kebutuhan.\n2. Kirim jadwal atau pertanyaan lanjutan.\n\n${cta}`
  }

  return `${opening}\n\n${details}\n\n${cta}`
})

function setFlash(kind: 'success' | 'error' | 'info', message: string, showToast = true) {
  flashKind.value = kind
  flashMessage.value = message
  if (showToast) {
    toast.notify({ kind, title: message })
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function htmlFromPlainText(value: string) {
  const blocks = value
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function plainTextFromHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase()
}

function createCustomKnowledgeSection(article?: KnowledgeArticle): CustomKnowledgeSection {
  return {
    key: article ? `custom-${article.id}` : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    id: article?.id,
    title: article?.title || '',
    content: article ? plainTextFromHtml(article.content) : '',
  }
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function resetSimulation() {
  simulationMessages.value = []
  previewAnswer.value = ''
  previewMatches.value = []
  previewSearchQuery.value = ''
  previewDetectedIntents.value = []
  previewReindexResults.value = []
}

async function scrollSimulationToLatest() {
  await nextTick()
  const el = simulationScrollEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

function addAnswerRule() {
  formatForm.customRules.push({ id: createId('rule'), text: '' })
}

function removeAnswerRule(index: number) {
  formatForm.customRules.splice(index, 1)
}

function buildTrainingPayload() {
  return {
    profile: {
      businessName: profileForm.businessName,
      assistantName: profileForm.assistantName,
      businessContext: profileForm.businessContext,
      greetingMessage: profileForm.greetingMessage,
      clarifyMessage: profileForm.clarifyMessage,
      fallbackMessage: profileForm.fallbackMessage,
    },
    format: {
      length: formatForm.length,
      tone: formatForm.tone,
      structure: formatForm.structure,
      ctaStyle: formatForm.ctaStyle,
      answerPrefix: formatForm.answerPrefix,
      customRules: formatForm.customRules.map((rule) => rule.text.trim()).filter(Boolean),
      advancedEnabled: formatForm.advancedEnabled,
      customInstruction: formatForm.customInstruction,
    },
    knowledgeSections: knowledgeSections.map((section) => ({
      key: section.key,
      id: section.id,
      title: section.title,
      content: section.content,
      group: section.group,
    })),
    customKnowledgeSections: customKnowledgeSections.map((section) => ({
      key: section.key,
      id: section.id,
      title: section.title,
      content: section.content,
      group: 'custom',
    })),
    removedKnowledgeIds: removedCustomKnowledgeIds.value,
  }
}

function addCustomKnowledge() {
  customKnowledgeSections.push(createCustomKnowledgeSection())
}

function addLeadQuestionKnowledge() {
  if (!leadQuestion.value) return

  const alreadyAdded = customKnowledgeSections.some((section) => section.content.includes(leadQuestion.value))
  if (alreadyAdded) {
    setFlash('info', 'Pertanyaan lead ini sudah ada di topik sendiri.')
    return
  }

  customKnowledgeSections.push({
    key: createId('lead-knowledge'),
    title: 'Jawaban dari Lead Fallback',
    content: `Pertanyaan pelanggan:\n${leadQuestion.value}\n\nJawaban yang sebaiknya AI berikan:\n`,
  })
  setFlash('success', 'Pertanyaan lead ditambahkan ke topik sendiri.')
}

function applyRouteStep() {
  const step = String(route.query.step || '').trim()
  const index = steps.findIndex((item) => item.id === step)
  if (index >= 0) {
    activeStep.value = index
  }
}

function removeCustomKnowledge(index: number) {
  const [removed] = customKnowledgeSections.splice(index, 1)
  if (removed?.id) {
    removedCustomKnowledgeIds.value.push(removed.id)
  }
}

function parseBusinessContext(value: string) {
  const nameMatch = value.match(/Nama bisnis:\s*([^\n]+)\n?/i)
  const serviceMatch = value.match(/Layanan:\s*([\s\S]+)/i)

  return {
    businessName: nameMatch?.[1]?.trim() || auth.user.value?.tenantName || '',
    businessContext: serviceMatch?.[1]?.trim() || value,
  }
}

function buildBusinessContext() {
  const name = profileForm.businessName.trim()
  const context = profileForm.businessContext.trim()

  if (name && context) return `Nama bisnis: ${name}\nLayanan: ${context}`
  return context || name || 'layanan informasi resmi'
}

function buildSystemPrompt() {
  const lengthInstruction = {
    short: 'Jawaban dibuat singkat, maksimal beberapa kalimat, dan langsung ke inti.',
    medium: 'Jawaban dibuat sedang, memakai poin penting bila membantu, dan tetap mudah dibaca.',
    complete: 'Jawaban boleh lebih lengkap bila dibutuhkan, tetapi tetap rapi dan tidak bertele-tele.',
  }[formatForm.length]

  const toneInstruction = {
    friendly: 'Gunakan gaya ramah seperti admin WhatsApp dan boleh menyapa pelanggan dengan kak.',
    professional: 'Gunakan gaya profesional, sopan, rapi, dan tetap hangat.',
    casual: 'Gunakan gaya santai, dekat, dan natural untuk percakapan WhatsApp.',
  }[formatForm.tone]

  const structureInstruction = {
    opening_details_cta: 'Susun jawaban dengan pembuka singkat, isi utama, lalu ajakan lanjut.',
    direct_bullets_cta: 'Susun jawaban langsung ke poin-poin penting, lalu ajakan lanjut.',
    summary_steps_cta: 'Susun jawaban dengan ringkasan, langkah berikutnya bila relevan, lalu ajakan lanjut.',
  }[formatForm.structure]

  const ctaInstruction = {
    ask_need: 'Tutup dengan pertanyaan ringan untuk memahami kebutuhan pelanggan.',
    invite_booking: 'Tutup dengan ajakan booking atau daftar bila informasinya sudah cukup.',
    offer_admin: 'Tutup dengan menawarkan bantuan admin bila pelanggan perlu dibantu langsung.',
  }[formatForm.ctaStyle]

  const customRules = formatForm.customRules
    .map((rule) => rule.text.trim())
    .filter(Boolean)
    .map((rule) => `Aturan tambahan: ${rule}`)

  const customInstruction =
    formatForm.advancedEnabled && formatForm.customInstruction.trim()
      ? [`Instruksi format khusus dari user: ${formatForm.customInstruction.trim()}`]
      : []

  return [
    'Anda adalah admin chat WhatsApp yang membantu pelanggan berdasarkan knowledge aktif.',
    toneInstruction,
    lengthInstruction,
    structureInstruction,
    ctaInstruction,
    ...customRules,
    ...customInstruction,
    'Jangan mengarang harga, jadwal, kebijakan, atau fakta yang tidak ada di knowledge.',
  ].join(' ')
}

function ensureKnowledgeBookingFlow(flow: AssistantFlowDraft) {
  const bookingActionKey = 'answer_booking_from_knowledge'
  let bookingAction = flow.actions.find((action) => action.key === bookingActionKey)

  if (!bookingAction) {
    bookingAction = {
      id: 'action-answer-booking-from-knowledge',
      key: bookingActionKey,
      type: 'answer_from_knowledge',
      label: 'Answer Booking from Knowledge',
      messageTemplate: formatForm.answerPrefix.trim(),
      fieldKeys: [],
    }
    flow.actions.push(bookingAction)
  }

  bookingAction.type = 'answer_from_knowledge'
  bookingAction.label = bookingAction.label || 'Answer Booking from Knowledge'
  bookingAction.messageTemplate = formatForm.answerPrefix.trim()
  bookingAction.fieldKeys = []

  let bookingIntent = flow.intents.find((intent) => intent.key === 'booking')
  if (!bookingIntent) {
    bookingIntent = {
      id: 'intent-booking',
      key: 'booking',
      label: 'Booking Request',
      keywords: [],
      searchHints: [],
      defaultAction: bookingActionKey,
    }
    flow.intents.push(bookingIntent)
  }

  if (bookingIntent) {
    bookingIntent.defaultAction = bookingActionKey
    bookingIntent.keywords = Array.from(new Set([...bookingIntent.keywords, 'booking', 'daftar', 'reservasi', 'jadwal']))
    bookingIntent.searchHints = Array.from(
      new Set([
        ...bookingIntent.searchHints,
        'cara daftar',
        'cara booking',
        'alur pendaftaran',
        'alur booking',
        'syarat booking',
        'jadwal tersedia',
      ]),
    )
  }

  const bookingRule = flow.routingRules.find((rule) => rule.intentKey === 'booking')
  if (bookingRule) {
    bookingRule.actionKey = bookingActionKey
    bookingRule.ifMissingFields = []
  } else {
    flow.routingRules.push({
      id: 'rule-booking-knowledge',
      intentKey: 'booking',
      actionKey: bookingActionKey,
      ifMissingFields: [],
      ifConfidenceBelow: null,
    })
  }
}

function ensureKnowledgePricingFlow(flow: AssistantFlowDraft) {
  const pricingIntent = flow.intents.find((intent) => intent.key === 'pricing')
  if (!pricingIntent) return

  pricingIntent.keywords = Array.from(new Set([...pricingIntent.keywords, 'harga', 'biaya', 'tarif', 'paket']))
  pricingIntent.searchHints = Array.from(
    new Set([
      ...pricingIntent.searchHints,
      'harga layanan',
      'biaya paket',
      'daftar paket',
      'pilihan paket',
      'promo',
    ]),
  )
}

function buildUpdatedFlow() {
  const flow = currentFlow.value ? deepClone(currentFlow.value) : null
  if (!flow) return null

  flow.profile.assistantName = profileForm.assistantName.trim() || 'Admin AI'
  flow.profile.businessContext = buildBusinessContext()
  flow.profile.greetingMessage = profileForm.greetingMessage.trim()
  flow.profile.clarifyMessage =
    profileForm.clarifyMessage.trim() ||
    'Siap kak, supaya lebih tepat saya bantu, boleh dijelaskan sedikit lebih detail kebutuhannya ya?'
  flow.profile.fallbackMessage = profileForm.fallbackMessage.trim()
  flow.profile.thanksMessage = flow.profile.thanksMessage || 'Sama-sama kak. Kalau masih ada yang ingin ditanyakan, saya siap bantu lagi ya.'
  flow.advanced.systemPrompt = buildSystemPrompt()
  flow.advanced.trainingFormat = {
    length: formatForm.length,
    tone: formatForm.tone,
    structure: formatForm.structure,
    ctaStyle: formatForm.ctaStyle,
    answerPrefix: formatForm.answerPrefix.trim(),
    customRules: formatForm.customRules.map((rule) => rule.text.trim()).filter(Boolean),
    advancedEnabled: formatForm.advancedEnabled,
    customInstruction: formatForm.customInstruction.trim(),
  }

  const answerAction = flow.actions.find((action) => action.type === 'answer_from_knowledge')
  if (answerAction) {
    answerAction.messageTemplate = formatForm.answerPrefix.trim()
  }

  ensureKnowledgeBookingFlow(flow)
  ensureKnowledgePricingFlow(flow)

  return flow
}

async function loadData() {
  loading.value = true
  try {
    await auth.fetchMe()
    const response = await apiFetch<AiTrainingResponse>(trainingEndpoint())

    profileForm.businessName = response.profile.businessName || auth.user.value?.tenantName || ''
    profileForm.assistantName = response.profile.assistantName || 'Admin AI'
    profileForm.businessContext = response.profile.businessContext || ''
    profileForm.greetingMessage = response.profile.greetingMessage || profileForm.greetingMessage
    profileForm.clarifyMessage = response.profile.clarifyMessage || profileForm.clarifyMessage
    profileForm.fallbackMessage = response.profile.fallbackMessage || profileForm.fallbackMessage

    formatForm.length = response.format.length || 'medium'
    formatForm.tone = response.format.tone || 'friendly'
    formatForm.structure = response.format.structure || 'opening_details_cta'
    formatForm.ctaStyle = response.format.ctaStyle || 'ask_need'
    formatForm.answerPrefix = response.format.answerPrefix || formatForm.answerPrefix
    formatForm.customRules.splice(
      0,
      formatForm.customRules.length,
      ...((response.format.customRules as unknown as string[]) || []).map((text) => ({
        id: createId('rule'),
        text,
      })),
    )
    formatForm.advancedEnabled = Boolean(response.format.advancedEnabled)
    formatForm.customInstruction = String(response.format.customInstruction || '')

    for (const incoming of response.knowledgeSections || []) {
      const section = knowledgeSections.find((item) => item.key === incoming.key || normalizeTitle(item.title) === normalizeTitle(incoming.title))
      if (!section) continue
      section.id = incoming.id
      section.content = incoming.content || ''
    }

    customKnowledgeSections.splice(
      0,
      customKnowledgeSections.length,
      ...(response.customKnowledgeSections || []).map((item) => ({
        key: item.key || `custom-${item.id || Date.now()}`,
        id: item.id,
        title: item.title,
        content: item.content,
      })),
    )
    removedCustomKnowledgeIds.value = []

    setFlash('info', 'Data pelatihan AI berhasil dimuat.', false)
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : 'Gagal memuat data pelatihan AI')
  } finally {
    loading.value = false
  }
}

async function saveConfigAndFlow() {
  const nextFlow = buildUpdatedFlow()
  if (!nextFlow) return

  await apiFetch<RagConfigResponse>('/rag-config', {
    method: 'PATCH',
    body: JSON.stringify({
      assistantName: nextFlow.profile.assistantName,
      businessContext: nextFlow.profile.businessContext,
      greetingMessage: nextFlow.profile.greetingMessage,
      fallbackMessage: nextFlow.profile.fallbackMessage,
      thanksMessage: nextFlow.profile.thanksMessage,
      systemPrompt: buildSystemPrompt(),
    }),
  })

  const response = await apiFetch<RagConfigResponse>('/rag-config/assistant-flow', {
    method: 'PATCH',
    body: JSON.stringify(nextFlow),
  })

  currentFlow.value = deepClone(response.assistantFlow)
}

async function saveKnowledgeSections() {
  const articles = await apiFetch<KnowledgeArticle[]>('/knowledge')

  for (const id of removedCustomKnowledgeIds.value) {
    await apiFetch(`/knowledge/${id}`, { method: 'DELETE' })
  }
  removedCustomKnowledgeIds.value = []

  for (const section of knowledgeSections) {
    const content = section.content.trim()
    if (!content) continue

    const existing = articles.find((item) => normalizeTitle(item.title) === normalizeTitle(section.title))
    const payload = {
      title: section.title,
      content: htmlFromPlainText(content),
    }

    if (existing) {
      await apiFetch(`/knowledge/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    } else {
      await apiFetch('/knowledge', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
  }

  for (const section of customKnowledgeSections) {
    const title = section.title.trim()
    const content = section.content.trim()
    if (!title || !content) continue

    const existing = section.id
      ? articles.find((item) => item.id === section.id)
      : articles.find((item) => normalizeTitle(item.title) === normalizeTitle(title))
    const payload = {
      title,
      content: htmlFromPlainText(content),
    }

    if (existing) {
      await apiFetch(`/knowledge/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      section.id = existing.id
      section.key = `custom-${existing.id}`
    } else {
      const response = await apiFetch<{ source: KnowledgeArticle }>('/knowledge', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (response.source?.id) {
        section.id = response.source.id
        section.key = `custom-${response.source.id}`
      }
    }
  }
}

async function saveDraft() {
  saving.value = true
  try {
    const response = await apiFetch<{ ok: boolean; assistantFlow: AssistantFlowDraft }>(trainingEndpoint(), {
      method: 'PATCH',
      body: JSON.stringify(buildTrainingPayload()),
    })
    currentFlow.value = response.assistantFlow ? deepClone(response.assistantFlow) : currentFlow.value
    removedCustomKnowledgeIds.value = []
    setFlash('success', 'Draft pelatihan AI berhasil disimpan.')
    return true
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : 'Gagal menyimpan draft')
    return false
  } finally {
    saving.value = false
  }
}

async function saveAndNext() {
  const saved = await saveDraft()
  if (!saved) return
  activeStep.value = Math.min(steps.length - 1, activeStep.value + 1)
}

async function runPreview() {
  const question = testQuestion.value.trim()
  if (!question) return

  const history = simulationMessages.value.map((message) => ({
    role: message.role,
    message: message.message,
  })).slice(-12)

  testing.value = true
  previewAnswer.value = ''
  previewMatches.value = []
  previewSearchQuery.value = ''
  previewDetectedIntents.value = []
  previewReindexResults.value = []
  simulationMessages.value.push({
    id: createId('sim-user'),
    role: 'user',
    message: question,
  })
  testQuestion.value = ''

  try {
    const result = await apiFetch<PreviewResult>(trainingEndpoint('/test'), {
      method: 'POST',
      body: JSON.stringify({
        question,
        history,
        saveBeforeTest: buildTrainingPayload(),
      }),
    })
    removedCustomKnowledgeIds.value = []
    previewAnswer.value = result.generatedAnswer || 'AI belum menemukan jawaban yang cukup yakin.'
    simulationMessages.value.push({
      id: createId('sim-ai'),
      role: 'assistant',
      message: previewAnswer.value,
    })
    previewMatches.value = Array.isArray(result.topMatches) ? result.topMatches : []
    previewSearchQuery.value = String(result.searchQuery || '')
    previewDetectedIntents.value = Array.isArray(result.detectedIntents) ? result.detectedIntents : []
    previewReindexResults.value = Array.isArray(result.reindex?.results) ? result.reindex.results : []
    setFlash('success', 'Simulasi jawaban AI selesai.')
  } catch (error) {
    setFlash('error', error instanceof Error ? error.message : 'Gagal menjalankan simulasi')
  } finally {
    testing.value = false
  }
}

watch(
  () => simulationMessages.value.length,
  () => {
    void scrollSimulationToLatest()
  },
)

onMounted(() => {
  applyRouteStep()
  void loadData()
})
</script>

<style scoped>
.step-button {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
  border-width: 1px;
  border-radius: 0.75rem;
  padding: 0.875rem;
  text-align: left;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.step-number {
  display: inline-flex;
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 700;
}

.format-mode-card {
  min-height: 6.75rem;
  border-width: 1px;
  border-radius: 0.75rem;
  padding: 1rem;
  text-align: left;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.format-mode-badge {
  flex-shrink: 0;
  border-radius: 9999px;
  padding: 0.1875rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1rem;
}

.format-mode-badge-active {
  background: rgb(70 95 255);
  color: white;
}

.format-mode-badge-idle {
  background: rgb(243 244 246);
  color: rgb(107 114 128);
}

.dark .format-mode-badge-idle {
  background: rgb(31 41 55);
  color: rgb(156 163 175);
}

.form-label {
  margin-bottom: 0.375rem;
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(55 65 81);
}

.dark .form-label {
  color: rgb(156 163 175);
}

.form-input,
.form-textarea {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid rgb(209 213 219);
  background: transparent;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: rgb(31 41 55);
  outline: none;
}

.form-input {
  min-height: 2.75rem;
}

.form-textarea {
  line-height: 1.625;
}

.form-input:focus,
.form-textarea:focus {
  border-color: rgb(70 95 255);
  box-shadow: 0 0 0 3px rgb(70 95 255 / 0.1);
}

.ghost-btn {
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  transition: background-color 0.2s ease;
}

.ghost-btn:hover {
  background: rgb(254 242 242);
}

.dark .ghost-btn:hover {
  background: rgb(127 29 29 / 0.2);
}

.dark .form-input,
.dark .form-textarea {
  border-color: rgb(55 65 81);
  background: rgb(17 24 39);
  color: rgb(243 244 246);
}

.simulation-chat-scroll {
  height: min(52vh, 520px);
  min-height: 360px;
  overflow-y: auto;
}

.wa-bubble,
.wa-user-bubble {
  width: fit-content;
  max-width: 100%;
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  line-height: 1.625;
  box-shadow: 0 1px 2px rgb(16 24 40 / 0.08);
}

.wa-bubble {
  background: white;
  color: rgb(31 41 55);
}

.wa-user-bubble {
  background: rgb(70 95 255);
  color: white;
}

.dark .wa-bubble {
  background: rgb(17 24 39);
  color: rgb(243 244 246);
}
</style>
