import { Injectable } from '@nestjs/common';

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

type ConversationTurn = {
  role: 'user' | 'assistant';
  message: string;
};

type IntentKey = 'price' | 'requirement' | 'schedule' | 'location' | 'registration' | 'contact';
type SalesStage = 'new' | 'discovery' | 'interested' | 'hot' | 'handoff';
type SalesContext = {
  tenantId: number;
  leadStage: SalesStage;
  leadScore: number;
  shouldOfferHandoff: boolean;
  detectedIntents: IntentKey[];
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

@Injectable()
export class RagService {
  private readonly greetingPatterns = [/^(halo+|hai|hi)\b/i, /^(pagi|siang|sore|malam)\b/i, /^(permisi|assalamualaikum|tes)\b/i];
  private readonly thanksPatterns = [/^(terima kasih|makasih|thanks|thx)\b/i];
  private readonly shortAmbiguousPatterns = [/^(bisa|mau tanya|tanya|info|permisi|tes|halo admin)\b/i];
  private readonly shortFollowupPatterns = [/^(ya|iya|iyaa|yaa|yap|yes|oke|ok|lanjut|boleh|mau|gimana|bagaimana)\b/i];
  private readonly menuSelectionPattern = /^[1-6]$/;
  private readonly intentPatterns: Record<IntentKey, RegExp[]> = {
    price: [/\b(harga|biaya|tarif|ongkos|bayar|dp|pembayaran)\b/i],
    requirement: [/\b(syarat|persyaratan|dokumen|berkas|ktp|minimal umur|usia)\b/i],
    schedule: [/\b(jadwal|jam|hari|buka|operasional|weekend|sabtu|minggu)\b/i],
    location: [/\b(alamat|lokasi|maps|map|tempat|kantor)\b/i],
    registration: [/\b(daftar|pendaftaran|registrasi|cara daftar|alur)\b/i],
    contact: [/\b(kontak|nomor|admin|cs|wa|whatsapp|telepon)\b/i],
  };

  private get assistantName() {
    return String(process.env.RAG_ASSISTANT_NAME || process.env.BUSINESS_NAME || 'admin').trim();
  }

  private get businessContext() {
    return String(
      process.env.RAG_BUSINESS_CONTEXT ||
        process.env.BUSINESS_DESCRIPTION ||
        'layanan informasi resmi',
    ).trim();
  }

  private buildHistorySnippet(history: ConversationTurn[]) {
    return history
      .filter((turn) => turn.message.trim())
      .map((turn) => `${turn.role === 'user' ? 'Pelanggan' : this.assistantName}: ${turn.message.trim()}`)
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

  private detectIntents(text: string) {
    return (Object.entries(this.intentPatterns) as Array<[IntentKey, RegExp[]]>)
      .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
      .map(([intent]) => intent);
  }

  private buildIntentHints(intents: IntentKey[]) {
    const labels: Record<IntentKey, string> = {
      price: 'harga biaya tarif pembayaran',
      requirement: 'syarat persyaratan dokumen berkas usia',
      schedule: 'jadwal jam operasional hari layanan',
      location: 'alamat lokasi kantor maps',
      registration: 'pendaftaran cara daftar alur registrasi',
      contact: 'kontak admin nomor whatsapp telepon',
    };

    return intents.map((intent) => labels[intent]).join('\n');
  }

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
  private get scoreThreshold() {
    return Number(process.env.RAG_SCORE_THRESHOLD || process.env.QDRANT_SCORE_THRESHOLD || 0.3);
  }
  private get topK() {
    return Number(process.env.RAG_TOP_K || 5);
  }
  private get maxChunks() {
    return Number(process.env.RAG_MAX_CONTEXT_CHUNKS || 3);
  }

  private async retrieveKnowledge(query: string, tenantId: number) {
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

    const searchRes = await fetch(
      `${this.qdrantUrl}/collections/${encodeURIComponent(this.qdrantCollection)}/points/search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vector,
          limit: this.topK,
          with_payload: true,
          filter: {
            must: [{ key: 'tenant_id', match: { value: tenantId } }],
          },
        }),
      },
    );
    const searchJson = await searchRes.json();
    if (!searchRes.ok) {
      throw new Error(`Qdrant search failed: ${JSON.stringify(searchJson)}`);
    }

    const rawResults: QdrantSearchResult[] = Array.isArray(searchJson.result) ? searchJson.result : [];
    const matches = rawResults
      .filter((item: QdrantSearchResult) => Number(item.score || 0) >= this.scoreThreshold)
      .slice(0, this.maxChunks)
      .map((item: QdrantSearchResult): RagMatch => ({
        score: Number(item.score || 0),
        text: String(item.payload?.text || '').trim(),
        title: item.payload?.title || 'Dokumen',
        page: item.payload?.page || null,
      }))
      .filter((item: RagMatch) => item.text);

    return { rawResults, matches };
  }

  private async buildPaymentInstructions(tenantId: number) {
    try {
      const { matches } = await this.retrieveKnowledge(
        'metode pembayaran transfer bank rekening pembayaran bukti bayar konfirmasi pembayaran',
        tenantId,
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
                'Ambil instruksi pembayaran dari konteks.',
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

  private buildSoftFallback(question: string, history: ConversationTurn[]) {
    const isFirstTurn = history.filter((turn) => turn.role === 'user').length <= 1;
    const wordCount = question.split(/\s+/).filter(Boolean).length;

    if (isFirstTurn || wordCount <= 6) {
      return 'Siap kak, saya bantu. Boleh dijelaskan sedikit pertanyaannya lebih detail, misalnya tentang harga, syarat, jadwal, prosedur, atau layanan tertentu ya kak?';
    }

    return 'Maaf kak, saya belum menemukan jawaban yang pas dari data yang ada. Kalau berkenan, boleh tulis pertanyaannya sedikit lebih rinci supaya saya coba cek lagi ya kak.';
  }

  private buildSalesCTA(context: SalesContext) {
    if (context.shouldOfferHandoff || context.leadStage === 'handoff') {
      return 'Kalau kakak sudah cocok, saya bantu lanjut ke tahap pendaftaran atau pembayaran sesuai data yang tersedia ya kak.';
    }

    if (context.leadStage === 'hot') {
      return 'Kalau kakak mau, saya bantu lanjut ke tahap berikutnya berdasarkan data yang sudah ada ya kak.';
    }

    if (context.leadStage === 'interested') {
      return 'Kalau kakak berkenan, saya bisa bantu rekomendasikan pilihan yang paling cocok sesuai kebutuhan kakak.';
    }

    return 'Kalau kakak mau, saya bisa bantu lanjutkan sesuai kebutuhan kakak ya.';
  }

  private buildMainMenu() {
    return [
      'Halo kak, saya siap bantu.',
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

  private resolveMenuSelection(question: string) {
    const selected = question.trim();
    if (!this.menuSelectionPattern.test(selected)) return null;

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

  private extractLabeledValue(text: string, labels: string[]) {
    for (const label of labels) {
      const pattern = new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n,]+)`, 'i');
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private isLikelyPersonName(line: string) {
    if (!line || /\d/.test(line)) return false;
    if (line.length < 3 || line.length > 40) return false;
    if (!/^[A-Za-zÀ-ÿ'`.\- ]+$/.test(line)) return false;
    if (
      /^(iya|ya|oke|ok|siap|halo|haloo|hai|hi|manual|matic|intensif|dasar|kilat|sabtu|minggu|senin|selasa|rabu|kamis|jumat|rek|rekening)$/i.test(
        line,
      )
    ) {
      return false;
    }
    if (/(nomor rekening|rekening|transfer|bayar|jadwal|domisili|nama|paket)/i.test(line)) return false;

    return true;
  }

  private isLikelyDomicile(line: string) {
    if (!line || /\d/.test(line)) return false;
    if (line.length < 3 || line.length > 50) return false;
    if (!/^[A-Za-zÀ-ÿ'`.\- ]+$/.test(line)) return false;
    if (
      /^(iya|ya|oke|ok|siap|halo|haloo|hai|hi|manual|matic|intensif|dasar|kilat|sabtu|minggu|senin|selasa|rabu|kamis|jumat|rek|rekening)$/i.test(
        line,
      )
    ) {
      return false;
    }
    if (/(nomor rekening|rekening|transfer|bayar|jadwal|paket|mobil|manual|matic)/i.test(line)) return false;
    if (
      /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i.test(
        line,
      )
    ) {
      return false;
    }

    return true;
  }

  private extractCollectedLeadData(question: string, history: ConversationTurn[]): CollectedLeadData {
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
      if (!/^[A-Za-zÀ-ÿ'`.\- ]+$/.test(line)) continue;
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
      if (!/^[A-Za-zÀ-ÿ'`.\- ]+$/.test(line)) continue;
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

  private async buildHandoffReply(data: CollectedLeadData, salesContext?: SalesContext) {
    const paymentInstructions = await this.buildPaymentInstructions(salesContext?.tenantId ?? 0);
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

  async generate(
    question: string,
    normalizedText: string,
    history: ConversationTurn[] = [],
    salesContext?: SalesContext,
  ): Promise<RagResult> {
    const menuSelection = this.resolveMenuSelection(question);
    const effectiveQuestion = menuSelection?.rewrittenQuestion || question;
    const effectiveNormalizedText = effectiveQuestion.replace(/\s+/g, ' ').toLowerCase();
    const detectedIntents = salesContext?.detectedIntents?.length
      ? salesContext.detectedIntents
      : this.detectIntents(`${effectiveQuestion}\n${history.map((turn) => turn.message).join('\n')}`);
    const collectedLeadData = this.extractCollectedLeadData(effectiveQuestion, history);

    if (
      salesContext &&
      (salesContext.leadStage === 'hot' || salesContext.leadStage === 'handoff') &&
      this.isAskingForPaymentAccount(question)
    ) {
      return {
        action: 'answer',
        reply: await this.buildPaymentInstructions(salesContext.tenantId),
        source: 'rag',
        metadata: {
          source: 'rag',
          payment_requested: true,
        },
      };
    }

    if (
      salesContext &&
      (salesContext.leadStage === 'hot' || salesContext.leadStage === 'handoff') &&
      this.hasMinimumHandoffData(collectedLeadData, salesContext)
    ) {
      return {
        action: 'answer',
        reply: await this.buildHandoffReply(collectedLeadData, salesContext),
        source: 'rag',
        metadata: {
          source: 'rag',
          handoff_ready: true,
          payment_requested: true,
          collected_lead_data: collectedLeadData,
        },
      };
    }

    if (
      salesContext &&
      (salesContext.leadStage === 'hot' || salesContext.leadStage === 'handoff') &&
      this.looksLikeLeadDataSubmission(question, collectedLeadData)
    ) {
      return {
        action: 'answer',
        reply: this.buildMissingDataReply(collectedLeadData, salesContext),
        source: 'rag',
        metadata: {
          source: 'rag',
          collected_lead_data: collectedLeadData,
          handoff_partial: true,
        },
      };
    }

    if (this.greetingPatterns.some((pattern) => pattern.test(normalizedText))) {
      return {
        action: 'answer',
        reply: this.buildMainMenu(),
        source: 'router_greeting',
        metadata: { source: 'router_greeting' },
      };
    }

    if (this.thanksPatterns.some((pattern) => pattern.test(normalizedText))) {
      return {
        action: 'answer',
        reply: `Sama-sama kak. Kalau masih ada yang ingin ditanyakan, kakak bisa kirim pertanyaan langsung atau pilih menu yang dibutuhkan ya.\n\n${this.buildMainMenu()}`,
        source: 'router_thanks',
        metadata: { source: 'router_thanks' },
      };
    }

    if (
      effectiveQuestion.split(/\s+/).filter(Boolean).length <= 4 &&
      this.shortAmbiguousPatterns.some((pattern) => pattern.test(effectiveNormalizedText)) &&
      detectedIntents.length === 0
    ) {
      return {
        action: 'answer',
        reply: `Siap kak, saya bantu. Supaya lebih cepat, kakak bisa pilih salah satu menu ini atau langsung tulis pertanyaan yang lebih spesifik ya.\n\n${this.buildMainMenu()}`,
        source: 'router_clarify',
        metadata: { source: 'router_clarify' },
      };
    }

    try {
      const historySnippet = this.buildHistorySnippet(history);
      const searchQuery = this.buildSearchQuery(effectiveQuestion, effectiveNormalizedText, history);
      const queryWithHints = detectedIntents.length
        ? `${searchQuery}\n${this.buildIntentHints(detectedIntents)}`
        : searchQuery;
      const { rawResults, matches } = await this.retrieveKnowledge(
        queryWithHints,
        salesContext?.tenantId ?? 0,
      );

      if (matches.length === 0) {
        return {
          action: 'fallback',
          reason: rawResults.length === 0 ? 'no_match' : 'low_confidence',
          reply: this.buildSoftFallback(question, history),
          metadata: {
            source: 'rag',
            top_score: rawResults[0]?.score ?? null,
            search_query: queryWithHints,
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
              content: [
                `Anda adalah ${this.assistantName}, admin chat WhatsApp yang ramah, sopan, dan membantu untuk ${this.businessContext}.`,
                'Peran Anda bukan hanya menjawab, tetapi juga menggiring lead secara halus sampai siap closing atau transfer ke admin.',
                'Jawab hanya berdasarkan konteks yang diberikan.',
                'Jika konteks tidak cukup, balas persis dengan __NO_ANSWER__.',
                'Gunakan bahasa Indonesia yang natural untuk chat WhatsApp dan sapa pelanggan dengan "kak" bila cocok.',
                'Gunakan tulisan biasa yang rapi. Jangan gunakan bold, tanda **, tabel markdown, atau format yang terlalu ramai.',
                'Hindari jawaban panjang bertele-tele. Buat singkat, jelas, dan langsung ke inti.',
                'Utamakan jawaban yang benar-benar menjelaskan isi materi yang relevan, bukan jawaban generik.',
                'Kalau konteks memuat beberapa poin penting seperti harga, syarat, jadwal, atau langkah, rangkum poin-poin itu dengan jelas.',
                'Tetap ringkas, tetapi jangan terlalu pendek kalau pertanyaan butuh penjelasan.',
                'Perhatikan riwayat chat agar jawaban tetap nyambung dengan percakapan sebelumnya.',
                'Kalau pertanyaan user sangat singkat, simpulkan maksud paling mungkin dari intent percakapannya sebelum menjawab.',
                'Setelah menjawab, usahakan beri pertanyaan lanjutan atau ajakan halus ke langkah berikutnya.',
                'Jika lead sudah hangat atau siap daftar, arahkan ke admin atau proses lanjutan dengan sopan.',
                'Kalau user sudah memberikan data seperti nama, nomor WhatsApp, pilihan paket, atau jadwal, jangan minta ulang data yang sama.',
                'Jika data utama untuk handoff sudah lengkap, cukup rangkum singkat lalu sampaikan bahwa admin akan melanjutkan proses.',
                'Jangan menyebut akan mengecek ketersediaan jadwal, stok, slot, atau data lain yang tidak ada di knowledge.',
                'Kalau mau closing, ajukan pertanyaan lanjutan hanya yang memang didukung knowledge, misalnya pilihan paket, jenis mobil, kelengkapan syarat, nominal DP, atau konfirmasi lanjut pembayaran.',
                'Jangan tambahkan footer sumber, referensi dokumen, atau tulisan "Sumber:" di jawaban ke user.',
                'Hindari pembuka berlebihan seperti "senang bertemu lagi" kecuali memang dibutuhkan konteksnya.',
                'Jangan mengarang kebijakan, harga, atau fakta yang tidak ada di konteks.',
              ].join(' '),
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
        return {
          action: 'fallback',
          reason: 'low_confidence',
          reply: this.buildSoftFallback(effectiveQuestion, history),
          metadata: { source: 'rag', top_score: matches[0]?.score ?? null, search_query: queryWithHints },
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
            tenantId: 0,
            leadStage: 'new',
            leadScore: 0,
            shouldOfferHandoff: false,
            detectedIntents,
          },
        )}`;
      }

      return {
        action: 'answer',
        reply: answer,
        source: 'rag',
        metadata: {
          source: 'rag',
          top_score: matches[0]?.score ?? null,
          search_query: queryWithHints,
        },
      };
    } catch (error) {
      return {
        action: 'fallback',
        reason: 'system_error',
        reply:
          'Maaf kak, saya lagi terkendala saat mencari jawaban dari data yang ada. Coba kirim ulang pertanyaannya atau tulis sedikit lebih detail ya kak.',
        metadata: {
          source: 'rag',
          error: String(error),
        },
      };
    }
  }
}
