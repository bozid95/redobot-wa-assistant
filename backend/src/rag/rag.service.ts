import { Injectable } from '@nestjs/common';
import {
  AssistantFlowDraft,
  AssistantFlowFieldType,
  AssistantFlowSource,
  createDefaultAssistantFlowDraft,
  getDefaultRagConfig,
  RagConfigInput,
  RagConfigValues,
} from './rag-config.defaults';
import { RagConfigService } from './rag-config.service';

type RagAnswerSource = 'rag' | 'router_greeting' | 'router_clarify' | 'router_thanks';
type QdrantSearchResult = {
  score?: number;
  payload?: {
    text?: string;
    title?: string;
    page?: number | null;
  };
};
type RagMatch = {
  score: number;
  text: string;
  title: string;
  page: number | null;
};

type RagResult =
  | { action: 'answer'; reply: string; source: RagAnswerSource; metadata: Record<string, unknown> }
  | { action: 'fallback'; reason: 'no_match' | 'low_confidence' | 'system_error'; reply: string; metadata: Record<string, unknown> };

export type ConversationTurn = {
  role: 'user' | 'assistant';
  message: string;
};

type SalesStage = 'new' | 'discovery' | 'interested' | 'hot' | 'handoff';
type SalesContext = {
  tenantId: number;
  leadStage: SalesStage;
  leadScore: number;
  shouldOfferHandoff: boolean;
  detectedIntents: string[];
  knownPhone?: string | null;
};

type CollectedLeadData = {
  name?: string | null;
  phone?: string | null;
  vehicleType?: 'manual' | 'matic' | null;
  packageName?: string | null;
  schedule?: string | null;
  domicile?: string | null;
};

type RuntimeConfig = {
  config: RagConfigValues;
  assistantFlow: AssistantFlowDraft;
  assistantFlowPersisted: boolean;
  assistantFlowSource: AssistantFlowSource;
};

type FlowIntent = AssistantFlowDraft['intents'][number];
type FlowAction = AssistantFlowDraft['actions'][number];
type FlowRule = AssistantFlowDraft['routingRules'][number];
type FlowField = AssistantFlowDraft['fields'][number];
type FlowCollectedData = Record<string, string | null>;

type ResolvedFlowRoute = {
  intent: FlowIntent | null;
  action: FlowAction | null;
  rule: FlowRule | null;
};

type RagDebugResult = {
  detectedIntents: string[];
  searchQuery: string;
  topMatches: Array<{ title: string; score: number; snippet: string }>;
  generatedAnswer: string;
};

@Injectable()
export class RagService {
  constructor(private readonly ragConfigService: RagConfigService) {}

  private readonly greetingPatterns = [/^(halo+|hai|hi)\b/i, /^(pagi|siang|sore|malam)\b/i, /^(permisi|assalamualaikum|tes)\b/i];
  private readonly thanksPatterns = [/^(terima kasih|makasih|thanks|thx)\b/i];
  private readonly shortAmbiguousPatterns = [/^(bisa|mau tanya|tanya|info|permisi|tes|halo admin)\b/i];
  private readonly shortFollowupPatterns = [/^(ya|iya|iyaa|yaa|yap|yes|oke|ok|lanjut|boleh|mau|gimana|bagaimana)\b/i];
  private readonly legacyMenuSelectionPattern = /^[1-6]$/;
  private readonly legacyIntentPatterns: Record<string, RegExp[]> = {
    price: [/\b(harga|biaya|tarif|ongkos|bayar|dp|pembayaran)\b/i],
    requirement: [/\b(syarat|persyaratan|dokumen|berkas|ktp|minimal umur|usia)\b/i],
    schedule: [/\b(jadwal|jam|hari|buka|operasional|weekend|sabtu|minggu)\b/i],
    location: [/\b(alamat|lokasi|maps|map|tempat|kantor)\b/i],
    registration: [/\b(daftar|pendaftaran|registrasi|cara daftar|alur)\b/i],
    contact: [/\b(kontak|nomor|admin|cs|wa|whatsapp|telepon)\b/i],
  };

  private get llmBaseUrl() {
    return String(process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  }
  private get llmApiKey() {
    return String(process.env.LLM_API_KEY || '');
  }
  private get chatModel() {
    return String(process.env.CHAT_MODEL || 'gpt-4.1-mini');
  }
  private get embeddingBaseUrl() {
    return String(process.env.EMBEDDING_BASE_URL || this.llmBaseUrl).replace(/\/$/, '');
  }
  private get embeddingApiKey() {
    return String(process.env.EMBEDDING_API_KEY || this.llmApiKey);
  }
  private get embeddingModel() {
    return String(process.env.EMBEDDING_MODEL || 'text-embedding-3-small');
  }
  private get qdrantUrl() {
    return String(process.env.QDRANT_URL || 'http://qdrant:6333').replace(/\/$/, '');
  }
  private get qdrantCollection() {
    return String(process.env.QDRANT_COLLECTION || 'wa_kb');
  }

  private async loadRuntimeConfig(tenantId: number, configOverride?: RagConfigInput): Promise<RuntimeConfig> {
    if (tenantId > 0) {
      const response = await this.ragConfigService.getResolvedConfig(tenantId, configOverride);
      return {
        config: response.config,
        assistantFlow: response.assistantFlow,
        assistantFlowPersisted: response.assistantFlowPersisted,
        assistantFlowSource: response.assistantFlowSource,
      };
    }

    const config = {
      ...getDefaultRagConfig(),
      ...(configOverride || {}),
    } satisfies RagConfigValues;

    return {
      config,
      assistantFlow: createDefaultAssistantFlowDraft(config),
      assistantFlowPersisted: false,
      assistantFlowSource: 'default',
    };
  }

  private mergeFlowProfileIntoConfig(config: RagConfigValues, flow: AssistantFlowDraft) {
    return {
      ...config,
      assistantName: flow.profile.assistantName || config.assistantName,
      businessContext: flow.profile.businessContext || config.businessContext,
      greetingMessage: flow.profile.greetingMessage || config.greetingMessage,
      clarifyMessage: flow.profile.clarifyMessage || config.clarifyMessage,
      fallbackMessage: flow.profile.fallbackMessage || config.fallbackMessage,
      thanksMessage: flow.profile.thanksMessage || config.thanksMessage,
    } satisfies RagConfigValues;
  }

  private buildHistorySnippet(history: ConversationTurn[], config: RagConfigValues) {
    return history
      .filter((turn) => turn.message.trim())
      .map((turn) => `${turn.role === 'user' ? 'Pelanggan' : config.assistantName}: ${turn.message.trim()}`)
      .join('\n');
  }

  private buildSearchQuery(question: string, normalizedText: string, history: ConversationTurn[]) {
    const recentUserMessages = history
      .filter((turn) => turn.role === 'user')
      .map((turn) => turn.message.trim())
      .filter(Boolean)
      .slice(-3);

    if (
      question.split(/\s+/).filter(Boolean).length <= 3 &&
      this.shortFollowupPatterns.some((pattern) => pattern.test(normalizedText))
    ) {
      return recentUserMessages.join('\n') || question;
    }

    return question;
  }

  private detectLegacyIntents(text: string) {
    return (Object.entries(this.legacyIntentPatterns) as Array<[string, RegExp[]]>)
      .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
      .map(([intent]) => intent);
  }

  private buildLegacyIntentHints(intents: string[]) {
    const labels: Record<string, string> = {
      price: 'harga biaya tarif pembayaran',
      requirement: 'syarat persyaratan dokumen berkas usia',
      schedule: 'jadwal jam operasional hari layanan',
      location: 'alamat lokasi kantor maps',
      registration: 'pendaftaran cara daftar alur registrasi',
      contact: 'kontak admin nomor whatsapp telepon',
    };

    return intents.map((intent) => labels[intent]).filter(Boolean).join('\n');
  }

  private detectFlowIntents(text: string, flow: AssistantFlowDraft) {
    const lower = text.toLowerCase();
    return flow.intents
      .map((intent) => ({
        key: intent.key,
        score: intent.keywords.reduce((count, keyword) => {
          return lower.includes(keyword.toLowerCase()) ? count + 1 : count;
        }, 0),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.key);
  }

  private buildFlowIntentHints(intentKeys: string[], flow: AssistantFlowDraft) {
    return intentKeys
      .map((key) => flow.intents.find((intent) => intent.key === key))
      .flatMap((intent) => intent?.searchHints || [])
      .filter(Boolean)
      .join('\n');
  }

  private async retrieveKnowledge(query: string, tenantId: number, config: RagConfigValues) {
    const embeddingRes = await fetch(`${this.embeddingBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.embeddingApiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: query,
      }),
    });
    const embeddingJson = await embeddingRes.json();
    if (!embeddingRes.ok) {
      throw new Error(`Embedding request failed: ${JSON.stringify(embeddingJson)}`);
    }

    const vector = embeddingJson.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('Embedding vector is empty');
    }

    const body: Record<string, unknown> = {
      vector,
      limit: config.topK,
      with_payload: true,
    };

    if (tenantId > 0) {
      body.filter = {
        must: [{ key: 'tenant_id', match: { value: tenantId } }],
      };
    }

    const searchRes = await fetch(
      `${this.qdrantUrl}/collections/${encodeURIComponent(this.qdrantCollection)}/points/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const searchJson = await searchRes.json();
    if (!searchRes.ok) {
      throw new Error(`Qdrant search failed: ${JSON.stringify(searchJson)}`);
    }

    const rawResults: QdrantSearchResult[] = Array.isArray(searchJson.result) ? searchJson.result : [];
    const matches = rawResults
      .filter((item: QdrantSearchResult) => Number(item.score || 0) >= config.scoreThreshold)
      .slice(0, config.maxChunks)
      .map((item: QdrantSearchResult): RagMatch => ({
        score: Number(item.score || 0),
        text: String(item.payload?.text || '').trim(),
        title: item.payload?.title || 'Dokumen',
        page: item.payload?.page || null,
      }))
      .filter((item: RagMatch) => item.text);

    return { rawResults, matches };
  }

  private async buildPaymentInstructions(tenantId: number, config: RagConfigValues) {
    try {
      const { matches } = await this.retrieveKnowledge(
        'metode pembayaran transfer bank rekening pembayaran bukti bayar konfirmasi pembayaran',
        tenantId,
        config,
      );
      if (matches.length === 0) {
        return 'Silakan lanjut transfer sesuai rekening pembayaran yang berlaku, lalu kirim bukti bayarnya di chat ini ya kak.';
      }

      const context = matches
        .map((match: RagMatch, index: number) => `[Sumber ${index + 1}: ${match.title}]\n${match.text}`)
        .join('\n\n');

      const answerRes = await fetch(`${this.llmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.llmApiKey}`,
        },
        body: JSON.stringify({
          model: this.chatModel,
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: [
                config.paymentPrompt,
                'Tulis singkat, rapi, tanpa bold dan tanpa tabel.',
                'Sebutkan nama bank, nama penerima, nomor rekening, jumlah DP bila tersedia, dan minta user kirim bukti bayar ke chat ini.',
                'Jika data pembayaran tidak jelas, balas persis dengan __NO_PAYMENT__.',
              ].join(' '),
            },
            {
              role: 'user',
              content: `Konteks pembayaran:\n${context}`,
            },
          ],
        }),
      });
      const answerJson = await answerRes.json();
      if (!answerRes.ok) {
        throw new Error(`Payment completion failed: ${JSON.stringify(answerJson)}`);
      }

      const answer = String(answerJson.choices?.[0]?.message?.content || '').trim();
      if (!answer || answer === '__NO_PAYMENT__') {
        return 'Silakan lanjut transfer sesuai rekening pembayaran yang berlaku, lalu kirim bukti bayarnya di chat ini ya kak.';
      }

      return answer.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\|/g, ' ').trim();
    } catch {
      return 'Silakan lanjut transfer sesuai rekening pembayaran yang berlaku, lalu kirim bukti bayarnya di chat ini ya kak.';
    }
  }

  private buildSoftFallback(question: string, history: ConversationTurn[], config: RagConfigValues) {
    const isFirstTurn = history.filter((turn) => turn.role === 'user').length <= 1;
    const wordCount = question.split(/\s+/).filter(Boolean).length;

    if (isFirstTurn || wordCount <= 6) {
      return config.clarifyMessage;
    }

    return config.fallbackMessage;
  }

  private buildSalesCTA(context: SalesContext, config: RagConfigValues) {
    if (context.shouldOfferHandoff || context.leadStage === 'handoff') {
      return config.salesCtaHandoff;
    }

    if (context.leadStage === 'hot') {
      return config.salesCtaHot;
    }

    if (context.leadStage === 'interested') {
      return config.salesCtaInterested;
    }

    return config.salesCtaNew;
  }

  private buildLegacyMainMenu(config: RagConfigValues) {
    return [
      config.greetingMessage,
      '',
      'Silakan pilih kebutuhan kakak:',
      '1. Lihat harga paket',
      '2. Tanya syarat pendaftaran',
      '3. Tanya jadwal atau jam operasional',
      '4. Tanya alamat atau lokasi',
      '5. Konsultasi paket yang cocok',
      '6. Langsung daftar atau hubungi admin',
      '',
      'Balas angka saja ya kak, misalnya 1 atau 5. Kalau kakak langsung kirim pertanyaan juga tetap bisa.',
    ].join('\n');
  }

  private buildFlowMainMenu(flow: AssistantFlowDraft, config: RagConfigValues) {
    if (!flow.profile.menuEnabled || !flow.profile.menuItems.length) {
      return config.greetingMessage;
    }

    return [
      flow.profile.greetingMessage || config.greetingMessage,
      '',
      'Silakan pilih kebutuhan kakak:',
      ...flow.profile.menuItems.map((item, index) => `${index + 1}. ${item.label}`),
      '',
      'Balas angka sesuai menu atau langsung kirim pertanyaan bebas ya kak.',
    ].join('\n');
  }

  private resolveLegacyMenuSelection(question: string) {
    const selected = question.trim();
    if (!this.legacyMenuSelectionPattern.test(selected)) return null;

    const mapping: Record<string, { rewrittenQuestion: string; reply: string }> = {
      '1': {
        rewrittenQuestion: 'tolong tampilkan daftar harga paket yang tersedia',
        reply: 'Siap kak, saya bantu tampilkan informasi harga paket yang tersedia ya.',
      },
      '2': {
        rewrittenQuestion: 'apa saja syarat pendaftaran',
        reply: 'Siap kak, saya bantu jelaskan syarat pendaftarannya ya.',
      },
      '3': {
        rewrittenQuestion: 'bagaimana jadwal dan jam operasional layanan',
        reply: 'Siap kak, saya bantu jelaskan jadwal dan jam operasionalnya ya.',
      },
      '4': {
        rewrittenQuestion: 'di mana alamat atau lokasi layanan',
        reply: 'Siap kak, saya bantu jelaskan alamat atau lokasi layanannya ya.',
      },
      '5': {
        rewrittenQuestion: 'tolong bantu rekomendasikan paket yang cocok',
        reply: 'Siap kak, saya bantu rekomendasikan pilihan yang paling cocok sesuai kebutuhan kakak ya.',
      },
      '6': {
        rewrittenQuestion: 'saya ingin daftar dan terhubung ke admin',
        reply: 'Siap kak, kalau kakak ingin lanjut daftar saya bantu arahkan ke proses berikutnya ya.',
      },
    };

    return mapping[selected];
  }

  private resolveFlowMenuSelection(question: string, flow: AssistantFlowDraft) {
    if (!flow.profile.menuEnabled) return null;

    const selected = Number(question.trim());
    if (!Number.isInteger(selected) || selected < 1 || selected > flow.profile.menuItems.length) {
      return null;
    }

    const item = flow.profile.menuItems[selected - 1];
    if (!item) return null;

    return {
      rewrittenQuestion: item.prompt,
      reply: `Siap kak, saya bantu untuk pilihan "${item.label}" ya.`,
    };
  }

  private extractLabeledValue(text: string, labels: string[]) {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n,]+)`, 'i');
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractConfiguredFields(question: string, history: ConversationTurn[], flow: AssistantFlowDraft, salesContext?: SalesContext) {
    const currentText = question.trim();
    const fullUserText = history
      .filter((turn) => turn.role === 'user')
      .map((turn) => turn.message.trim())
      .concat(currentText)
      .join('\n');

    const lowerCurrent = currentText.toLowerCase();
    const lowerFull = fullUserText.toLowerCase();
    const data: FlowCollectedData = {};

    for (const field of flow.fields) {
      const candidates = [
        field.label,
        field.key,
        field.key.replace(/_/g, ' '),
      ].filter(Boolean);
      const explicit = this.extractLabeledValue(currentText, candidates) || this.extractLabeledValue(fullUserText, candidates);
      let value: string | null = explicit;

      if (!value) {
        value = this.extractFieldByType(field, lowerCurrent, lowerFull, currentText, fullUserText, salesContext);
      }

      data[field.key] = value;
    }

    return data;
  }

  private extractFieldByType(
    field: FlowField,
    lowerCurrent: string,
    lowerFull: string,
    currentText: string,
    fullUserText: string,
    salesContext?: SalesContext,
  ) {
    if (field.type === 'phone') {
      const phoneMatch =
        currentText.match(/(?:\+?62|0)\d{8,15}/) ||
        fullUserText.match(/(?:\+?62|0)\d{8,15}/);
      return phoneMatch?.[0] || salesContext?.knownPhone || null;
    }

    if (field.type === 'date') {
      const dateMatch =
        currentText.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/) ||
        fullUserText.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/) ||
        currentText.match(/\b\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}\b/i) ||
        fullUserText.match(/\b\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}\b/i);
      return dateMatch?.[0] || null;
    }

    if (field.type === 'select') {
      const options = Array.isArray(field.options) ? field.options : [];
      const matched = options.find((option) => lowerCurrent.includes(option.toLowerCase()) || lowerFull.includes(option.toLowerCase()));
      return matched || null;
    }

    if (field.type === 'text' || field.type === 'textarea') {
      return null;
    }

    return null;
  }

  private resolveFlowRoute(intentKeys: string[], flow: AssistantFlowDraft): ResolvedFlowRoute {
    for (const key of intentKeys) {
      const intent = flow.intents.find((item) => item.key === key) || null;
      if (!intent) continue;

      const rule = flow.routingRules.find((item) => item.intentKey === key && item.actionKey) || null;
      const actionKey = rule?.actionKey || intent.defaultAction;
      const action = actionKey
        ? flow.actions.find((item) => item.key === actionKey) || null
        : null;

      return { intent, action, rule };
    }

    return { intent: null, action: null, rule: null };
  }

  private formatCollectedFieldSummary(data: FlowCollectedData, flow: AssistantFlowDraft, fieldKeys: string[]) {
    return fieldKeys
      .map((key) => {
        const field = flow.fields.find((item) => item.key === key);
        const value = data[key];
        if (!field || !value) return null;
        return `${field.label}: ${value}.`;
      })
      .filter(Boolean)
      .join(' ');
  }

  private buildMissingFieldsReply(
    data: FlowCollectedData,
    flow: AssistantFlowDraft,
    fieldKeys: string[],
    action: FlowAction,
  ) {
    const fields = fieldKeys
      .map((key) => flow.fields.find((item) => item.key === key))
      .filter((field): field is FlowField => Boolean(field));
    const missing = fields.filter((field) => !data[field.key]);
    const known = fields.filter((field) => data[field.key]);

    const pieces = [
      action.messageTemplate || 'Siap kak, saya bantu catat data yang dibutuhkan dulu ya.',
      known.length ? this.formatCollectedFieldSummary(data, flow, known.map((field) => field.key)) : null,
      missing.length
        ? `Yang masih perlu dilengkapi: ${missing.map((field) => field.label).join(', ')} ya kak.`
        : 'Data utama sudah lengkap. Saya siap lanjutkan ke langkah berikutnya ya kak.',
    ].filter(Boolean);

    return pieces.join(' ');
  }

  private async executeFlowAction(
    route: ResolvedFlowRoute,
    data: FlowCollectedData,
    flow: AssistantFlowDraft,
    tenantId: number,
    config: RagConfigValues,
  ): Promise<{ reply: string; metadata: Record<string, unknown> } | null> {
    const action = route.action;
    if (!action) return null;

    if (action.type === 'collect_fields') {
      const configuredKeys = action.fieldKeys?.length
        ? action.fieldKeys
        : route.rule?.ifMissingFields?.length
          ? route.rule.ifMissingFields
          : flow.fields.filter((field) => field.required).map((field) => field.key);

      return {
        reply: this.buildMissingFieldsReply(data, flow, configuredKeys, action),
        metadata: {
          source: 'rag',
          assistant_flow: true,
          flow_action: action.key,
          flow_type: action.type,
          collected_flow_data: data,
          missing_fields: configuredKeys.filter((key) => !data[key]),
        },
      };
    }

    if (action.type === 'handoff_admin') {
      return {
        reply: action.messageTemplate || 'Baik kak, saya bantu arahkan ke admin agar bisa lanjut ditangani langsung ya.',
        metadata: {
          source: 'rag',
          assistant_flow: true,
          flow_action: action.key,
          flow_type: action.type,
          handoff_ready: true,
        },
      };
    }

    if (action.type === 'send_custom_message') {
      return {
        reply: action.messageTemplate || config.clarifyMessage,
        metadata: {
          source: 'rag',
          assistant_flow: true,
          flow_action: action.key,
          flow_type: action.type,
        },
      };
    }

    if (action.type === 'send_payment_info') {
      const payment = await this.buildPaymentInstructions(tenantId, config);
      const reply = [action.messageTemplate, payment].filter(Boolean).join('\n\n').trim();
      return {
        reply: reply || payment,
        metadata: {
          source: 'rag',
          assistant_flow: true,
          flow_action: action.key,
          flow_type: action.type,
          payment_requested: true,
        },
      };
    }

    return null;
  }

  private buildSystemInstructions(config: RagConfigValues) {
    return [
      `Anda adalah ${config.assistantName}, admin chat WhatsApp yang ramah, sopan, dan membantu untuk ${config.businessContext}.`,
      config.systemPrompt,
      'Jawab hanya berdasarkan konteks yang diberikan.',
      'Jika konteks tidak cukup, balas persis dengan __NO_ANSWER__.',
      'Gunakan bahasa Indonesia yang natural untuk chat WhatsApp dan sapa pelanggan dengan "kak" bila cocok.',
      'Gunakan tulisan biasa yang rapi. Jangan gunakan bold, tanda **, tabel markdown, atau format yang terlalu ramai.',
      'Hindari jawaban panjang bertele-tele. Buat singkat, jelas, dan langsung ke inti.',
      'Perhatikan riwayat chat agar jawaban tetap nyambung dengan percakapan sebelumnya.',
      'Jangan tambahkan footer sumber, referensi dokumen, atau tulisan "Sumber:" di jawaban ke user.',
      'Jangan mengarang kebijakan, harga, atau fakta yang tidak ada di konteks.',
    ].join(' ');
  }

  private toDebugMatches(matches: RagMatch[]) {
    return matches.map((match) => ({
      title: match.title,
      score: Number(match.score.toFixed(2)),
      snippet: match.text.slice(0, 220),
    }));
  }

  private extractLegacyCollectedLeadData(question: string, history: ConversationTurn[]): CollectedLeadData {
    const currentText = question.trim();
    const fullUserText = history
      .filter((turn) => turn.role === 'user')
      .map((turn) => turn.message.trim())
      .concat(currentText)
      .join('\n');

    const currentLines = currentText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const phoneMatch =
      currentText.match(/(?:\+?62|0)\d{8,15}/) || fullUserText.match(/(?:\+?62|0)\d{8,15}/);
    const schedulePattern =
      /\b(?:jadwal(?:\s+mulai)?\s*[:\-]?\s*)?((?:minggu|senin|selasa|rabu|kamis|jumat|sabtu)?\s*,?\s*\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4})\b/i;
    const scheduleMatch = currentText.match(schedulePattern) || fullUserText.match(schedulePattern);
    const packageMatch =
      currentText.match(/\bpaket\s+(intensif|dasar|kilat)\b/i) ||
      fullUserText.match(/\bpaket\s+(intensif|dasar|kilat)\b/i);

    const explicitName =
      this.extractLabeledValue(currentText, ['nama lengkap', 'nama']) ||
      this.extractLabeledValue(fullUserText, ['nama lengkap', 'nama']);
    const explicitDomicile =
      this.extractLabeledValue(currentText, ['domisili', 'alamat']) ||
      this.extractLabeledValue(fullUserText, ['domisili', 'alamat']);
    const hasStructuredSignal =
      currentLines.length >= 2 ||
      Boolean(
        explicitName ||
          explicitDomicile ||
          phoneMatch?.[0] ||
          scheduleMatch?.[1] ||
          /(domisili|nama|jadwal|alamat)/i.test(currentText),
      );

    let name: string | null = explicitName;
    for (const line of hasStructuredSignal && !name ? currentLines.slice(-6) : []) {
      if (/\d/.test(line)) continue;
      if (line.length < 3 || line.length > 40) continue;
      if (!/^[A-Za-z'`.\- ]+$/.test(line)) continue;
      if (/^(iya|ya|oke|ok|siap|halo|haloo|hai|hi|manual|matic|intensif|dasar|kilat)$/i.test(line)) continue;
      name = line;
    }

    const lowerText = `${currentText}\n${fullUserText}`.toLowerCase();
    const vehicleType = /\bmanual\b/.test(lowerText)
      ? 'manual'
      : /\bmatic\b/.test(lowerText)
        ? 'matic'
        : null;
    let domicile: string | null = explicitDomicile;
    for (const line of hasStructuredSignal && !domicile ? currentLines.slice(-6) : []) {
      if (/\d/.test(line)) continue;
      if (line.length < 3 || line.length > 50) continue;
      if (!/^[A-Za-z'`.\- ]+$/.test(line)) continue;
      if (name && line.toLowerCase() === name.toLowerCase()) continue;
      if (/^(iya|ya|oke|ok|siap|halo|haloo|hai|hi|manual|matic|intensif|dasar|kilat|kebetulan|bebas)$/i.test(line)) continue;
      if (/(senin|selasa|rabu|kamis|jumat|sabtu|minggu|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i.test(line)) continue;
      domicile = line;
    }

    return {
      name,
      phone: phoneMatch?.[0] || null,
      vehicleType,
      packageName: packageMatch ? `paket ${packageMatch[1].toLowerCase()}` : null,
      schedule: scheduleMatch?.[1] || scheduleMatch?.[0] || null,
      domicile,
    };
  }

  private hasMinimumHandoffData(data: CollectedLeadData, salesContext?: SalesContext) {
    return Boolean(data.name && (salesContext?.knownPhone || data.phone) && data.schedule);
  }

  private async buildHandoffReply(data: CollectedLeadData, salesContext: SalesContext | undefined, config: RagConfigValues) {
    const paymentInstructions = await this.buildPaymentInstructions(salesContext?.tenantId ?? 0, config);
    const pieces = [
      'Siap kak, data kakak sudah saya catat.',
      data.name ? `Nama: ${data.name}.` : null,
      (salesContext?.knownPhone || data.phone) ? `No. WhatsApp: ${salesContext?.knownPhone || data.phone}.` : null,
      data.domicile ? `Domisili: ${data.domicile}.` : null,
      data.schedule ? `Jadwal yang diajukan: ${data.schedule}.` : null,
      data.packageName ? `Paket: ${data.packageName}.` : null,
      data.vehicleType ? `Pilihan mobil: ${data.vehicleType}.` : null,
      paymentInstructions,
      'Setelah transfer, kirim bukti bayar di chat ini ya kak. Setelah itu data akan saya simpan dan admin lanjut konfirmasi.',
    ].filter(Boolean);

    return pieces.join(' ');
  }

  private isAskingForPaymentAccount(question: string) {
    return /\b(rekening|nomor rekening|no rekening|no rek|nomor rek|transfer ke mana|bank mana|kirim ke mana|pembayaran ke mana)\b/i.test(
      question,
    );
  }

  private looksLikeLeadDataSubmission(question: string, data: CollectedLeadData) {
    const trimmedQuestion = question.trim();
    const lineCount = trimmedQuestion
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean).length;

    const hasExplicitLabels = /(nama|domisili|alamat|jadwal)\s*[:\-]/i.test(trimmedQuestion);
    const hasPhone = /(?:\+?62|0)\d{8,15}/.test(trimmedQuestion);
    const hasSchedule =
      /\b\d{1,2}\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}\b/i.test(
        trimmedQuestion,
      );
    const dataPoints = [data.name, data.phone, data.domicile, data.schedule].filter(Boolean).length;
    if (this.isAskingForPaymentAccount(trimmedQuestion)) {
      return false;
    }

    return hasExplicitLabels || ((hasPhone || hasSchedule) && lineCount >= 2 && dataPoints >= 2);
  }

  private buildMissingDataReply(data: CollectedLeadData, salesContext?: SalesContext) {
    const missing: string[] = [];
    if (!data.name) missing.push('nama lengkap');
    if (!data.domicile) missing.push('domisili');
    if (!data.schedule) missing.push('jadwal yang diinginkan');

    const knownParts = [
      'Siap kak, sebagian data sudah saya catat.',
      data.name ? `Nama: ${data.name}.` : null,
      (salesContext?.knownPhone || data.phone) ? `No. WhatsApp: ${salesContext?.knownPhone || data.phone}.` : null,
      data.domicile ? `Domisili: ${data.domicile}.` : null,
      data.schedule ? `Jadwal: ${data.schedule}.` : null,
      missing.length
        ? `Yang masih perlu dilengkapi: ${missing.join(', ')} ya kak.`
        : null,
    ].filter(Boolean);

    return knownParts.join(' ');
  }

  private async runLegacyRag(
    question: string,
    normalizedText: string,
    history: ConversationTurn[],
    salesContext: SalesContext | undefined,
    config: RagConfigValues,
  ): Promise<{ result: RagResult; debug: RagDebugResult }> {
    const tenantId = salesContext?.tenantId ?? 0;
    const menuSelection = this.resolveLegacyMenuSelection(question);
    const effectiveQuestion = menuSelection?.rewrittenQuestion || question;
    const effectiveNormalizedText = effectiveQuestion.replace(/\s+/g, ' ').toLowerCase();
    const detectedIntents = salesContext?.detectedIntents?.length
      ? salesContext.detectedIntents
      : this.detectLegacyIntents(`${effectiveQuestion}\n${history.map((turn) => turn.message).join('\n')}`);
    const collectedLeadData = this.extractLegacyCollectedLeadData(effectiveQuestion, history);

    if (
      salesContext &&
      (salesContext.leadStage === 'hot' || salesContext.leadStage === 'handoff') &&
      this.isAskingForPaymentAccount(question)
    ) {
      const reply = await this.buildPaymentInstructions(salesContext.tenantId, config);
      return {
        result: {
          action: 'answer',
          reply,
          source: 'rag',
          metadata: {
            source: 'rag',
            payment_requested: true,
          },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }

    if (
      salesContext &&
      (salesContext.leadStage === 'hot' || salesContext.leadStage === 'handoff') &&
      this.hasMinimumHandoffData(collectedLeadData, salesContext)
    ) {
      const reply = await this.buildHandoffReply(collectedLeadData, salesContext, config);
      return {
        result: {
          action: 'answer',
          reply,
          source: 'rag',
          metadata: {
            source: 'rag',
            handoff_ready: true,
            payment_requested: true,
            collected_lead_data: collectedLeadData,
          },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }

    if (
      salesContext &&
      (salesContext.leadStage === 'hot' || salesContext.leadStage === 'handoff') &&
      this.looksLikeLeadDataSubmission(question, collectedLeadData)
    ) {
      const reply = this.buildMissingDataReply(collectedLeadData, salesContext);
      return {
        result: {
          action: 'answer',
          reply,
          source: 'rag',
          metadata: {
            source: 'rag',
            collected_lead_data: collectedLeadData,
            handoff_partial: true,
          },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }

    if (this.greetingPatterns.some((pattern) => pattern.test(normalizedText))) {
      const reply = this.buildLegacyMainMenu(config);
      return {
        result: {
          action: 'answer',
          reply,
          source: 'router_greeting',
          metadata: { source: 'router_greeting' },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }

    if (this.thanksPatterns.some((pattern) => pattern.test(normalizedText))) {
      const reply = `${config.thanksMessage}\n\n${this.buildLegacyMainMenu(config)}`;
      return {
        result: {
          action: 'answer',
          reply,
          source: 'router_thanks',
          metadata: { source: 'router_thanks' },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }

    if (
      effectiveQuestion.split(/\s+/).filter(Boolean).length <= 4 &&
      this.shortAmbiguousPatterns.some((pattern) => pattern.test(effectiveNormalizedText)) &&
      detectedIntents.length === 0
    ) {
      const reply = `${config.clarifyMessage}\n\n${this.buildLegacyMainMenu(config)}`;
      return {
        result: {
          action: 'answer',
          reply,
          source: 'router_clarify',
          metadata: { source: 'router_clarify' },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }

    try {
      const historySnippet = this.buildHistorySnippet(history, config);
      const searchQuery = this.buildSearchQuery(effectiveQuestion, effectiveNormalizedText, history);
      const queryWithHints = detectedIntents.length
        ? `${searchQuery}\n${this.buildLegacyIntentHints(detectedIntents)}`
        : searchQuery;
      const { rawResults, matches } = await this.retrieveKnowledge(
        queryWithHints,
        tenantId,
        config,
      );

      if (matches.length === 0) {
        const reply = this.buildSoftFallback(question, history, config);
        return {
          result: {
            action: 'fallback',
            reason: rawResults.length === 0 ? 'no_match' : 'low_confidence',
            reply,
            metadata: {
              source: 'rag',
              top_score: rawResults[0]?.score ?? null,
              search_query: queryWithHints,
            },
          },
          debug: {
            detectedIntents,
            searchQuery: queryWithHints,
            topMatches: this.toDebugMatches(matches),
            generatedAnswer: reply,
          },
        };
      }

      const context = matches
        .map((match: RagMatch, index: number) => {
          const sourceBits = [match.title];
          if (match.page) {
            sourceBits.push(`hal. ${match.page}`);
          }
          return `[Sumber ${index + 1}: ${sourceBits.join(' | ')}]\n${match.text}`;
        })
        .join('\n\n');

      const answerRes = await fetch(`${this.llmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.llmApiKey}`,
        },
        body: JSON.stringify({
          model: this.chatModel,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: this.buildSystemInstructions(config),
            },
            {
              role: 'user',
              content: `Riwayat chat:\n${historySnippet || '-'}\n\nPertanyaan terbaru:\n${effectiveQuestion}\n\nLead stage: ${salesContext?.leadStage || 'new'}\nLead score: ${salesContext?.leadScore || 0}\nIntent terdeteksi: ${detectedIntents.join(', ') || '-'}\nPerlu tawarkan handoff admin: ${salesContext?.shouldOfferHandoff ? 'ya' : 'tidak'}\nData yang sudah terkumpul: ${JSON.stringify(collectedLeadData)}\n\nKonteks knowledge:\n${context}`,
            },
          ],
        }),
      });
      const answerJson = await answerRes.json();
      if (!answerRes.ok) {
        throw new Error(`Chat completion failed: ${JSON.stringify(answerJson)}`);
      }

      let answer = String(answerJson.choices?.[0]?.message?.content || '').trim();
      if (!answer || answer === '__NO_ANSWER__') {
        const reply = this.buildSoftFallback(effectiveQuestion, history, config);
        return {
          result: {
            action: 'fallback',
            reason: 'low_confidence',
            reply,
            metadata: { source: 'rag', top_score: matches[0]?.score ?? null, search_query: queryWithHints },
          },
          debug: {
            detectedIntents,
            searchQuery: queryWithHints,
            topMatches: this.toDebugMatches(matches),
            generatedAnswer: reply,
          },
        };
      }

      answer = answer.replace(/\s{3,}/g, '\n\n').trim();
      answer = answer.replace(/\*\*/g, '').replace(/\*/g, '');
      answer = answer.replace(/\|/g, ' ');
      answer = answer.replace(/\n?\s*Sumber\s*:[\s\S]*$/i, '').trim();
      if (menuSelection?.reply) {
        answer = `${menuSelection.reply}\n\n${answer}`;
      }
      if (!/(\?|admin|daftar|lanjut|hubung|jadwal|pilih)/i.test(answer)) {
        answer = `${answer}\n\n${this.buildSalesCTA(
          salesContext || {
            tenantId: tenantId,
            leadStage: 'new',
            leadScore: 0,
            shouldOfferHandoff: false,
            detectedIntents,
          },
          config,
        )}`;
      }

      return {
        result: {
          action: 'answer',
          reply: answer,
          source: 'rag',
          metadata: {
            source: 'rag',
            top_score: matches[0]?.score ?? null,
            search_query: queryWithHints,
          },
        },
        debug: {
          detectedIntents,
          searchQuery: queryWithHints,
          topMatches: this.toDebugMatches(matches),
          generatedAnswer: answer,
        },
      };
    } catch (error) {
      const reply =
        'Maaf kak, saya lagi terkendala saat mencari jawaban dari data yang ada. Coba kirim ulang pertanyaannya atau tulis sedikit lebih detail ya kak.';
      return {
        result: {
          action: 'fallback',
          reason: 'system_error',
          reply,
          metadata: {
            source: 'rag',
            error: String(error),
          },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }
  }

  private async runAssistantFlowRag(
    question: string,
    normalizedText: string,
    history: ConversationTurn[],
    salesContext: SalesContext | undefined,
    config: RagConfigValues,
    flow: AssistantFlowDraft,
  ): Promise<{ result: RagResult; debug: RagDebugResult }> {
    const tenantId = salesContext?.tenantId ?? 0;
    const flowConfig = this.mergeFlowProfileIntoConfig(config, flow);
    const menuSelection = this.resolveFlowMenuSelection(question, flow);
    const effectiveQuestion = menuSelection?.rewrittenQuestion || question;
    const effectiveNormalizedText = effectiveQuestion.replace(/\s+/g, ' ').toLowerCase();
    const detectedIntents = this.detectFlowIntents(
      `${effectiveQuestion}\n${history.map((turn) => turn.message).join('\n')}`,
      flow,
    );
    const route = this.resolveFlowRoute(detectedIntents, flow);
    const collectedFlowData = this.extractConfiguredFields(effectiveQuestion, history, flow, salesContext);

    if (this.greetingPatterns.some((pattern) => pattern.test(normalizedText))) {
      const reply = this.buildFlowMainMenu(flow, flowConfig);
      return {
        result: {
          action: 'answer',
          reply,
          source: 'router_greeting',
          metadata: { source: 'router_greeting', assistant_flow: true },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }

    if (this.thanksPatterns.some((pattern) => pattern.test(normalizedText))) {
      const menu = this.buildFlowMainMenu(flow, flowConfig);
      const reply = flow.profile.menuEnabled
        ? `${flowConfig.thanksMessage}\n\n${menu}`
        : flowConfig.thanksMessage;
      return {
        result: {
          action: 'answer',
          reply,
          source: 'router_thanks',
          metadata: { source: 'router_thanks', assistant_flow: true },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }

    if (
      effectiveQuestion.split(/\s+/).filter(Boolean).length <= 4 &&
      this.shortAmbiguousPatterns.some((pattern) => pattern.test(effectiveNormalizedText)) &&
      detectedIntents.length === 0
    ) {
      const menu = flow.profile.menuEnabled ? `\n\n${this.buildFlowMainMenu(flow, flowConfig)}` : '';
      const reply = `${flowConfig.clarifyMessage}${menu}`;
      return {
        result: {
          action: 'answer',
          reply,
          source: 'router_clarify',
          metadata: { source: 'router_clarify', assistant_flow: true },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }

    if (route.action && route.action.type !== 'answer_from_knowledge') {
      const directReply = await this.executeFlowAction(
        route,
        collectedFlowData,
        flow,
        tenantId,
        config,
      );
      if (directReply) {
        const reply = menuSelection?.reply
          ? `${menuSelection.reply}\n\n${directReply.reply}`
          : directReply.reply;
        return {
          result: {
            action: 'answer',
            reply,
            source: 'rag',
            metadata: {
              ...directReply.metadata,
              detected_intents: detectedIntents,
            },
          },
          debug: {
            detectedIntents,
            searchQuery: '',
            topMatches: [],
            generatedAnswer: reply,
          },
        };
      }
    }

    try {
      const historySnippet = this.buildHistorySnippet(history, flowConfig);
      const searchQuery = this.buildSearchQuery(effectiveQuestion, effectiveNormalizedText, history);
      const flowHints = this.buildFlowIntentHints(detectedIntents, flow);
      const queryWithHints = flowHints ? `${searchQuery}\n${flowHints}` : searchQuery;
      const { rawResults, matches } = await this.retrieveKnowledge(queryWithHints, tenantId, config);

      if (matches.length === 0) {
        const reply = this.buildSoftFallback(question, history, flowConfig);
        return {
          result: {
            action: 'fallback',
            reason: rawResults.length === 0 ? 'no_match' : 'low_confidence',
            reply,
            metadata: {
              source: 'rag',
              assistant_flow: true,
              top_score: rawResults[0]?.score ?? null,
              search_query: queryWithHints,
              detected_intents: detectedIntents,
            },
          },
          debug: {
            detectedIntents,
            searchQuery: queryWithHints,
            topMatches: this.toDebugMatches(matches),
            generatedAnswer: reply,
          },
        };
      }

      const context = matches
        .map((match: RagMatch, index: number) => {
          const sourceBits = [match.title];
          if (match.page) {
            sourceBits.push(`hal. ${match.page}`);
          }
          return `[Sumber ${index + 1}: ${sourceBits.join(' | ')}]\n${match.text}`;
        })
        .join('\n\n');

      const answerRes = await fetch(`${this.llmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.llmApiKey}`,
        },
        body: JSON.stringify({
          model: this.chatModel,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: this.buildSystemInstructions(flowConfig),
            },
            {
              role: 'user',
              content: `Riwayat chat:\n${historySnippet || '-'}\n\nPertanyaan terbaru:\n${effectiveQuestion}\n\nIntent terdeteksi: ${detectedIntents.join(', ') || '-'}\nAction terpilih: ${route.action?.key || '-'}\nFlow data yang sudah terkumpul: ${JSON.stringify(collectedFlowData)}\n\nKonteks knowledge:\n${context}`,
            },
          ],
        }),
      });
      const answerJson = await answerRes.json();
      if (!answerRes.ok) {
        throw new Error(`Chat completion failed: ${JSON.stringify(answerJson)}`);
      }

      let answer = String(answerJson.choices?.[0]?.message?.content || '').trim();
      if (!answer || answer === '__NO_ANSWER__') {
        const reply = this.buildSoftFallback(effectiveQuestion, history, flowConfig);
        return {
          result: {
            action: 'fallback',
            reason: 'low_confidence',
            reply,
            metadata: {
              source: 'rag',
              assistant_flow: true,
              top_score: matches[0]?.score ?? null,
              search_query: queryWithHints,
              detected_intents: detectedIntents,
            },
          },
          debug: {
            detectedIntents,
            searchQuery: queryWithHints,
            topMatches: this.toDebugMatches(matches),
            generatedAnswer: reply,
          },
        };
      }

      answer = answer.replace(/\s{3,}/g, '\n\n').trim();
      answer = answer.replace(/\*\*/g, '').replace(/\*/g, '');
      answer = answer.replace(/\|/g, ' ');
      answer = answer.replace(/\n?\s*Sumber\s*:[\s\S]*$/i, '').trim();

      if (route.action?.messageTemplate && route.action.type === 'answer_from_knowledge') {
        answer = `${route.action.messageTemplate}\n\n${answer}`;
      }

      if (menuSelection?.reply) {
        answer = `${menuSelection.reply}\n\n${answer}`;
      }

      return {
        result: {
          action: 'answer',
          reply: answer,
          source: 'rag',
          metadata: {
            source: 'rag',
            assistant_flow: true,
            flow_action: route.action?.key || null,
            top_score: matches[0]?.score ?? null,
            search_query: queryWithHints,
            detected_intents: detectedIntents,
          },
        },
        debug: {
          detectedIntents,
          searchQuery: queryWithHints,
          topMatches: this.toDebugMatches(matches),
          generatedAnswer: answer,
        },
      };
    } catch (error) {
      const reply =
        'Maaf kak, saya lagi terkendala saat mencari jawaban dari data yang ada. Coba kirim ulang pertanyaannya atau tulis sedikit lebih detail ya kak.';
      return {
        result: {
          action: 'fallback',
          reason: 'system_error',
          reply,
          metadata: {
            source: 'rag',
            assistant_flow: true,
            error: String(error),
          },
        },
        debug: {
          detectedIntents,
          searchQuery: '',
          topMatches: [],
          generatedAnswer: reply,
        },
      };
    }
  }

  private async runRag(
    question: string,
    normalizedText: string,
    history: ConversationTurn[] = [],
    salesContext?: SalesContext,
    configOverride?: RagConfigInput,
  ): Promise<{ result: RagResult; debug: RagDebugResult }> {
    const tenantId = salesContext?.tenantId ?? 0;
    const runtime = await this.loadRuntimeConfig(tenantId, configOverride);

    if (runtime.assistantFlowSource !== 'default') {
      return this.runAssistantFlowRag(
        question,
        normalizedText,
        history,
        salesContext,
        runtime.config,
        runtime.assistantFlow,
      );
    }

    return this.runLegacyRag(
      question,
      normalizedText,
      history,
      salesContext,
      runtime.config,
    );
  }

  async test(input: {
    tenantId: number;
    question: string;
    history?: ConversationTurn[];
    configOverride?: RagConfigInput;
  }) {
    const history = Array.isArray(input.history) ? input.history : [];
    const normalizedText = input.question.replace(/\s+/g, ' ').toLowerCase();
    const { debug } = await this.runRag(
      input.question,
      normalizedText,
      history,
      {
        tenantId: input.tenantId,
        leadStage: 'new',
        leadScore: 0,
        shouldOfferHandoff: false,
        detectedIntents: [],
      },
      input.configOverride,
    );

    return debug;
  }

  async generate(
    question: string,
    normalizedText: string,
    history: ConversationTurn[] = [],
    salesContext?: SalesContext,
  ): Promise<RagResult> {
    const { result } = await this.runRag(question, normalizedText, history, salesContext);
    return result;
  }
}
