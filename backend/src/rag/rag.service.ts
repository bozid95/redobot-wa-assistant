import { Injectable } from '@nestjs/common';
import {
  AssistantFlowDraft,
  AssistantFlowFieldType,
  createDefaultAssistantFlowDraft,
  getDefaultRagConfig,
  RagConfigInput,
  RagConfigValues,
} from './rag-config.defaults';
import { RagConfigService } from './rag-config.service';
import { KnowledgeService } from '../knowledge/knowledge.service';

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

type RuntimeConfig = {
  config: RagConfigValues;
  assistantFlow: AssistantFlowDraft;
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

type MenuSelection = {
  rewrittenQuestion: string;
  reply: string;
};

type RagDebugResult = {
  detectedIntents: string[];
  searchQuery: string;
  topMatches: Array<{ title: string; score: number; snippet: string }>;
  generatedAnswer: string;
};

@Injectable()
export class RagService {
  constructor(
    private readonly ragConfigService: RagConfigService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  private readonly greetingPatterns = [/^(ha+lo+|ha+llo+|he+llo+|hai+|hi+)\b/i, /^(pagi|siang|sore|malam)\b/i, /^(permisi|assalamualaikum|assalamu'alaikum|tes)\b/i];
  private readonly thanksPatterns = [/^(terima kasih|makasih|thanks|thx)\b/i];
  private readonly shortAmbiguousPatterns = [/^(bisa|mau tanya|tanya|info|permisi|tes|halo admin)\b/i];
  private readonly shortFollowupPatterns = [/^(ya|iya|iyaa|yaa|yap|yes|oke|ok|lanjut|boleh|mau|gimana|bagaimana)\b/i];

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
      };
    }

    const config = {
      ...getDefaultRagConfig(),
      ...(configOverride || {}),
    } satisfies RagConfigValues;

    return {
      config,
      assistantFlow: createDefaultAssistantFlowDraft(config),
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

  private isGreetingOnly(text: string) {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized) return false;
    if (!this.greetingPatterns.some((pattern) => pattern.test(normalized))) return false;

    const remainder = normalized
      .replace(/^(ha+lo+|ha+llo+|he+llo+|hai+|hi+|pagi|siang|sore|malam|permisi|assalamualaikum|assalamu'alaikum|tes)\b[!,.?\s]*/i, '')
      .replace(/^(kak|admin|min|gan|sis|bro)\b[!,.?\s]*/i, '')
      .trim();

    return !remainder;
  }

  private detectFlowIntents(text: string, flow: AssistantFlowDraft) {
    const lower = text.toLowerCase();
    return flow.intents
      .map((intent) => {
        let score = intent.keywords.reduce((count, keyword) => {
          const normalizedKeyword = keyword.trim().toLowerCase();
          return normalizedKeyword && lower.includes(normalizedKeyword) ? count + 1 : count;
        }, 0);

        if (intent.key === 'pricing' && /\b(harga|biaya|tarif|paket|promo)\b/i.test(lower)) {
          score += 2;
        }

        if (intent.key === 'booking' && /\b(daftar|booking|reservasi)\s+paket/i.test(lower)) {
          score = Math.max(0, score - 1);
        }

        return {
          key: intent.key,
          score,
        };
      })
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

  private stripHtml(value: string) {
    return String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenizeForKeywordSearch(value: string) {
    const tokens = String(value || '')
      .toLowerCase()
      .split(/[^a-z0-9\u00c0-\u024f]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length > 2);

    const synonyms: Record<string, string[]> = {
      harga: ['biaya', 'tarif', 'paket', 'price', 'pricing'],
      biaya: ['harga', 'tarif', 'paket'],
      tarif: ['harga', 'biaya', 'paket'],
      paket: ['harga', 'biaya', 'tarif'],
      alamat: ['lokasi', 'maps', 'tempat'],
      lokasi: ['alamat', 'maps', 'tempat'],
      jadwal: ['jam', 'buka', 'operasional'],
      daftar: ['booking', 'reservasi', 'pendaftaran'],
      booking: ['daftar', 'reservasi', 'pendaftaran'],
      bayar: ['pembayaran', 'transfer', 'rekening', 'dp'],
    };

    return [...new Set(tokens.flatMap((token) => [token, ...(synonyms[token] || [])]))];
  }

  private async retrieveKnowledgeByKeyword(query: string, tenantId: number, config: RagConfigValues) {
    if (!tenantId) return [];

    const tokens = this.tokenizeForKeywordSearch(query);
    if (!tokens.length) return [];

    const articles = await this.knowledgeService.list(tenantId);
    return articles
      .map((article): RagMatch | null => {
        const title = String(article.title || '').trim();
        const text = this.stripHtml(article.content);
        if (!title || !text) return null;

        const titleLower = title.toLowerCase();
        const textLower = text.toLowerCase();
        const score = tokens.reduce((total, token) => {
          if (titleLower.includes(token)) return total + 2;
          if (textLower.includes(token)) return total + 1;
          return total;
        }, 0);

        if (score <= 0) return null;

        return {
          title,
          text: text.length > 1800 ? `${text.slice(0, 1800).trim()}...` : text,
          page: null,
          score: Math.min(0.95, 0.55 + score / Math.max(tokens.length * 3, 1)),
        };
      })
      .filter((match): match is RagMatch => Boolean(match))
      .sort((a, b) => b.score - a.score)
      .slice(0, config.maxChunks);
  }

  private async retrieveKnowledge(query: string, tenantId: number, config: RagConfigValues) {
    try {
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

      if (matches.length) {
        return { rawResults, matches };
      }

      const keywordMatches = await this.retrieveKnowledgeByKeyword(query, tenantId, config);
      return { rawResults, matches: keywordMatches };
    } catch (error) {
      const keywordMatches = await this.retrieveKnowledgeByKeyword(query, tenantId, config);
      if (keywordMatches.length) {
        return { rawResults: [], matches: keywordMatches };
      }

      throw error;
    }
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

  private buildFlowMainMenu(flow: AssistantFlowDraft, config: RagConfigValues) {
    return flow.profile.greetingMessage || config.greetingMessage;
  }

  private resolveFlowMenuSelection(_question: string, _flow: AssistantFlowDraft): MenuSelection | null {
    return null;
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

    if (this.isGreetingOnly(normalizedText)) {
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

    return this.runAssistantFlowRag(
      question,
      normalizedText,
      history,
      salesContext,
      runtime.config,
      runtime.assistantFlow,
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
