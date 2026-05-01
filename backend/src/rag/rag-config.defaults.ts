export type RagConfigValues = {
  assistantName: string
  businessContext: string
  greetingMessage: string
  clarifyMessage: string
  fallbackMessage: string
  thanksMessage: string
  salesCtaNew: string
  salesCtaInterested: string
  salesCtaHot: string
  salesCtaHandoff: string
  systemPrompt: string
  paymentPrompt: string
  scoreThreshold: number
  topK: number
  maxChunks: number
  chunkTargetTokens: number
}

export type RagConfigInput = Partial<RagConfigValues>

export type AssistantFlowActionType =
  | 'answer_from_knowledge'
  | 'collect_fields'
  | 'handoff_admin'
  | 'send_payment_info'
  | 'send_custom_message'

export type AssistantFlowFieldType = 'text' | 'phone' | 'date' | 'select' | 'textarea'

export type AssistantFlowDraft = {
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
    type: AssistantFlowFieldType
    required: boolean
    placeholder: string
    helpText: string
    options?: string[]
  }>
  actions: Array<{
    id: string
    key: string
    type: AssistantFlowActionType
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

export type AssistantFlowInput = Partial<AssistantFlowDraft>

export type AssistantFlowSource = 'default' | 'template' | 'tenant'

export type AssistantTemplateInput = {
  name?: string
  description?: string
  assistantFlow?: AssistantFlowInput
}

export type AssistantTemplateSummary = {
  id: number
  name: string
  slug: string
  description: string
  isSystem: boolean
  updatedAt: string
  assistantFlow: AssistantFlowDraft
}

export function getDefaultRagConfig(): RagConfigValues {
  return {
    assistantName: String(process.env.RAG_ASSISTANT_NAME || process.env.BUSINESS_NAME || 'admin').trim(),
    businessContext: String(
      process.env.RAG_BUSINESS_CONTEXT ||
        process.env.BUSINESS_DESCRIPTION ||
        'layanan informasi resmi',
    ).trim(),
    greetingMessage:
      'Halo kak, saya siap bantu. Silakan pilih kebutuhan kakak atau langsung kirim pertanyaannya ya.',
    clarifyMessage:
      'Siap kak, supaya lebih tepat saya bantu, boleh dijelaskan sedikit lebih detail kebutuhannya ya?',
    fallbackMessage:
      'Maaf kak, saya belum menemukan jawaban yang pas dari knowledge yang aktif. Boleh ditulis lebih detail supaya saya coba cek lagi?',
    thanksMessage:
      'Sama-sama kak. Kalau masih ada yang ingin ditanyakan, saya siap bantu lagi ya.',
    salesCtaNew: 'Kalau kakak mau, saya bisa bantu lanjutkan sesuai kebutuhan kakak ya.',
    salesCtaInterested:
      'Kalau kakak berkenan, saya bisa bantu rekomendasikan pilihan yang paling cocok sesuai kebutuhan kakak.',
    salesCtaHot:
      'Kalau kakak mau, saya bantu lanjut ke tahap berikutnya berdasarkan data yang sudah ada ya kak.',
    salesCtaHandoff:
      'Kalau kakak sudah cocok, saya bantu lanjut ke tahap pendaftaran atau pembayaran sesuai data yang tersedia ya kak.',
    systemPrompt: [
      'Anda adalah admin chat WhatsApp yang ramah, sopan, dan membantu.',
      'Jawab hanya berdasarkan konteks yang diberikan, singkat, jelas, dan tetap menggiring lead ke langkah berikutnya.',
    ].join(' '),
    paymentPrompt:
      'Ambil instruksi pembayaran dari konteks. Tulis singkat, rapi, dan minta user mengirim bukti bayar ke chat ini jika sudah transfer.',
    scoreThreshold: Number(process.env.RAG_SCORE_THRESHOLD || process.env.QDRANT_SCORE_THRESHOLD || 0.3),
    topK: Number(process.env.RAG_TOP_K || 5),
    maxChunks: Number(process.env.RAG_MAX_CONTEXT_CHUNKS || 3),
    chunkTargetTokens: Number(process.env.CHUNK_TARGET_TOKENS || 700),
  }
}

export function createDefaultAssistantFlowDraft(config: Partial<RagConfigValues> = {}): AssistantFlowDraft {
  const resolved = {
    ...getDefaultRagConfig(),
    ...config,
  }

  return {
    profile: {
      assistantName: resolved.assistantName,
      businessContext: resolved.businessContext,
      greetingMessage: resolved.greetingMessage,
      clarifyMessage: resolved.clarifyMessage,
      fallbackMessage: resolved.fallbackMessage,
      thanksMessage: resolved.thanksMessage,
      menuEnabled: true,
      menuItems: [
        {
          id: 'menu-pricing',
          label: 'Tanya harga',
          prompt: 'tolong tampilkan harga layanan yang tersedia',
        },
        {
          id: 'menu-booking',
          label: 'Mau reservasi',
          prompt: 'saya ingin reservasi atau booking layanan',
        },
      ],
    },
    intents: [
      {
        id: 'intent-pricing',
        key: 'pricing',
        label: 'Pricing Inquiry',
        keywords: ['harga', 'biaya', 'tarif'],
        searchHints: ['harga layanan', 'biaya paket', 'promo'],
        defaultAction: 'answer_pricing',
      },
      {
        id: 'intent-booking',
        key: 'booking',
        label: 'Booking Request',
        keywords: ['booking', 'reservasi', 'jadwal', 'daftar'],
        searchHints: ['cara booking', 'jadwal tersedia', 'alur reservasi'],
        defaultAction: 'collect_booking',
      },
      {
        id: 'intent-contact-admin',
        key: 'contact_admin',
        label: 'Admin Handoff',
        keywords: ['admin', 'operator', 'hubungi', 'telepon'],
        searchHints: ['kontak admin', 'hubungi operator'],
        defaultAction: 'handoff_admin_now',
      },
    ],
    fields: [
      {
        id: 'field-full-name',
        key: 'full_name',
        label: 'Nama Lengkap',
        type: 'text',
        required: true,
        placeholder: 'Tulis nama lengkap',
        helpText: 'Dipakai untuk identifikasi pelanggan.',
      },
      {
        id: 'field-phone',
        key: 'phone',
        label: 'Nomor WhatsApp',
        type: 'phone',
        required: true,
        placeholder: '08xxxxxxxxxx',
        helpText: 'Bisa dipakai untuk follow up manual.',
      },
      {
        id: 'field-service-type',
        key: 'service_type',
        label: 'Jenis Layanan',
        type: 'select',
        required: false,
        placeholder: '',
        helpText: 'Pilih kategori layanan yang diinginkan.',
        options: ['Basic Consultation', 'Premium Session', 'Home Visit'],
      },
      {
        id: 'field-preferred-date',
        key: 'preferred_date',
        label: 'Tanggal Pilihan',
        type: 'date',
        required: false,
        placeholder: '',
        helpText: 'Untuk kebutuhan reservasi atau booking.',
      },
    ],
    actions: [
      {
        id: 'action-answer-pricing',
        key: 'answer_pricing',
        type: 'answer_from_knowledge',
        label: 'Answer Pricing from Knowledge',
        messageTemplate: 'Saya bantu cek informasi harga dari knowledge yang aktif ya kak.',
      },
      {
        id: 'action-collect-booking',
        key: 'collect_booking',
        type: 'collect_fields',
        label: 'Collect Booking Data',
        messageTemplate: 'Siap kak, sebelum lanjut booking saya bantu catat dulu beberapa data penting.',
        fieldKeys: ['full_name', 'phone', 'preferred_date'],
      },
      {
        id: 'action-handoff-admin',
        key: 'handoff_admin_now',
        type: 'handoff_admin',
        label: 'Handoff to Admin',
        messageTemplate: 'Baik kak, saya bantu arahkan ke admin agar bisa lanjut ditangani langsung.',
      },
      {
        id: 'action-payment-guide',
        key: 'send_payment_guide',
        type: 'send_payment_info',
        label: 'Send Payment Guide',
        messageTemplate: 'Saya bantu kirim arahan pembayaran yang berlaku ya kak.',
      },
      {
        id: 'action-custom-followup',
        key: 'send_custom_followup',
        type: 'send_custom_message',
        label: 'Custom Follow Up Message',
        messageTemplate: 'Kalau kakak berkenan, saya bisa bantu arahkan ke langkah berikutnya sesuai kebutuhan kakak.',
      },
    ],
    routingRules: [
      {
        id: 'rule-pricing',
        intentKey: 'pricing',
        actionKey: 'answer_pricing',
        ifConfidenceBelow: resolved.scoreThreshold,
      },
      {
        id: 'rule-booking',
        intentKey: 'booking',
        actionKey: 'collect_booking',
        ifMissingFields: ['full_name', 'phone'],
      },
      {
        id: 'rule-contact-admin',
        intentKey: 'contact_admin',
        actionKey: 'handoff_admin_now',
      },
    ],
    advanced: {
      systemPrompt: resolved.systemPrompt,
      paymentPrompt: resolved.paymentPrompt,
      scoreThreshold: resolved.scoreThreshold,
      topK: resolved.topK,
      maxChunks: resolved.maxChunks,
      chunkTargetTokens: resolved.chunkTargetTokens,
    },
  }
}
