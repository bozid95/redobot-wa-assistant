import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard, SessionPayload } from '../common/auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AssistantFlowDraft } from './rag-config.defaults';
import { RagConfigService } from './rag-config.service';
import { ConversationTurn, RagService } from './rag.service';

type TrainingFormat = {
  length?: 'short' | 'medium' | 'complete';
  tone?: 'friendly' | 'professional' | 'casual';
  structure?: 'opening_details_cta' | 'direct_bullets_cta' | 'summary_steps_cta';
  ctaStyle?: 'ask_need' | 'invite_booking' | 'offer_admin';
  answerPrefix?: string;
};

type TrainingProfile = {
  businessName?: string;
  assistantName?: string;
  businessContext?: string;
  greetingMessage?: string;
  clarifyMessage?: string;
  fallbackMessage?: string;
};

type TrainingKnowledgeSection = {
  key?: string;
  id?: number;
  title?: string;
  content?: string;
  group?: 'primary' | 'optional' | 'custom';
};

type AiTrainingSaveInput = {
  profile?: TrainingProfile;
  format?: TrainingFormat;
  knowledgeSections?: TrainingKnowledgeSection[];
  customKnowledgeSections?: TrainingKnowledgeSection[];
  removedKnowledgeIds?: number[];
};

const defaultKnowledgeSections: Array<{
  key: string;
  title: string;
  help: string;
  placeholder: string;
  group: 'primary' | 'optional';
}> = [
  {
    key: 'faq',
    title: 'FAQ Umum',
    help: 'Pertanyaan yang paling sering ditanyakan pelanggan.',
    placeholder:
      'Contoh:\n- Apakah pemula bisa ikut?\nBisa, program tersedia untuk pemula.\n\n- Apakah bisa pilih jadwal?\nBisa, jadwal menyesuaikan ketersediaan instruktur.',
    group: 'primary',
  },
  {
    key: 'pricing',
    title: 'Harga dan Paket',
    help: 'Daftar paket, harga, durasi, promo, dan perbedaan tiap paket.',
    placeholder:
      'Contoh:\nPaket Basic: Rp...\nPaket Regular: Rp...\nPaket Intensif: Rp...\n\nHarga dapat berubah sesuai promo yang sedang berlaku.',
    group: 'primary',
  },
  {
    key: 'booking',
    title: 'Cara Daftar atau Booking',
    help: 'Alur pendaftaran, data yang perlu dikumpulkan, dan langkah berikutnya.',
    placeholder:
      'Contoh:\n1. Pilih paket.\n2. Kirim nama, nomor WA, dan jadwal pilihan.\n3. Admin konfirmasi ketersediaan.\n4. Lakukan pembayaran DP jika diperlukan.',
    group: 'primary',
  },
  {
    key: 'hours',
    title: 'Jam Layanan',
    help: 'Jam operasional, jadwal admin, atau jadwal layanan.',
    placeholder:
      'Contoh:\nAdmin melayani chat setiap Senin-Sabtu pukul 08.00-20.00.\nSesi latihan tersedia pagi, siang, dan sore sesuai jadwal.',
    group: 'optional',
  },
  {
    key: 'location',
    title: 'Lokasi dan Area Layanan',
    help: 'Alamat, cabang, area layanan, atau titik temu.',
    placeholder:
      'Contoh:\nAlamat kantor: ...\nArea layanan: Jakarta Selatan, Depok, dan sekitarnya.\nTitik temu bisa disesuaikan berdasarkan jadwal.',
    group: 'optional',
  },
  {
    key: 'payment',
    title: 'Pembayaran',
    help: 'Metode bayar, DP, pelunasan, dan instruksi bukti transfer.',
    placeholder:
      'Contoh:\nPembayaran bisa melalui transfer bank atau QRIS.\nDP minimal Rp...\nSetelah transfer, pelanggan mengirim bukti pembayaran ke chat ini.',
    group: 'optional',
  },
  {
    key: 'policy',
    title: 'Kebijakan Penting',
    help: 'Syarat, reschedule, refund, garansi, atau batasan klaim.',
    placeholder:
      'Contoh:\nReschedule maksimal H-1 sesuai ketersediaan jadwal.\nBiaya yang sudah dibayarkan tidak dapat dikembalikan kecuali ada pembatalan dari pihak kami.',
    group: 'optional',
  },
];

@Controller('ai-training')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.platform_admin, UserRole.tenant_admin)
export class AiTrainingController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly ragConfigService: RagConfigService,
    private readonly ragService: RagService,
  ) {}

  private resolveTenantId(request: { user?: SessionPayload }, requestedTenantId?: string) {
    const parsedRequestedTenantId = Number(requestedTenantId || 0);
    const tenantId =
      request.user?.role === UserRole.platform_admin && Number.isInteger(parsedRequestedTenantId) && parsedRequestedTenantId > 0
        ? parsedRequestedTenantId
        : request.user?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('User belum terhubung ke tenant');
    }

    this.assertOwnTenant(request, tenantId);
    return tenantId;
  }

  private sanitizeString(value: unknown) {
    return String(value ?? '').trim();
  }

  private normalizeTitle(value: string) {
    return value.trim().toLowerCase();
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private htmlFromPlainText(value: string) {
    return value
      .trim()
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${this.escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  private plainTextFromHtml(value: string) {
    return String(value || '')
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
      .trim();
  }

  private parseBusinessContext(value: string, fallbackName: string) {
    const nameMatch = value.match(/Nama bisnis:\s*([^\n]+)\n?/i);
    const serviceMatch = value.match(/Layanan:\s*([\s\S]+)/i);

    return {
      businessName: nameMatch?.[1]?.trim() || fallbackName || '',
      businessContext: serviceMatch?.[1]?.trim() || value,
    };
  }

  private buildBusinessContext(profile: TrainingProfile) {
    const businessName = this.sanitizeString(profile.businessName);
    const context = this.sanitizeString(profile.businessContext);

    if (businessName && context) return `Nama bisnis: ${businessName}\nLayanan: ${context}`;
    return context || businessName || 'layanan informasi resmi';
  }

  private normalizeFormat(format?: TrainingFormat): Required<TrainingFormat> {
    return {
      length: ['short', 'medium', 'complete'].includes(String(format?.length))
        ? format?.length || 'medium'
        : 'medium',
      tone: ['friendly', 'professional', 'casual'].includes(String(format?.tone))
        ? format?.tone || 'friendly'
        : 'friendly',
      structure: ['opening_details_cta', 'direct_bullets_cta', 'summary_steps_cta'].includes(
        String(format?.structure),
      )
        ? format?.structure || 'opening_details_cta'
        : 'opening_details_cta',
      ctaStyle: ['ask_need', 'invite_booking', 'offer_admin'].includes(String(format?.ctaStyle))
        ? format?.ctaStyle || 'ask_need'
        : 'ask_need',
      answerPrefix:
        this.sanitizeString(format?.answerPrefix) || 'Saya bantu cek informasinya ya kak.',
    };
  }

  private buildSystemPrompt(format?: TrainingFormat) {
    const normalized = this.normalizeFormat(format);
    const lengthInstruction = {
      short: 'Jawaban dibuat singkat, maksimal beberapa kalimat, dan langsung ke inti.',
      medium: 'Jawaban dibuat sedang, memakai poin penting bila membantu, dan tetap mudah dibaca.',
      complete:
        'Jawaban boleh lebih lengkap bila dibutuhkan, tetapi tetap rapi dan tidak bertele-tele.',
    }[normalized.length];

    const toneInstruction = {
      friendly: 'Gunakan gaya ramah seperti admin WhatsApp dan boleh menyapa pelanggan dengan kak.',
      professional: 'Gunakan gaya profesional, sopan, rapi, dan tetap hangat.',
      casual: 'Gunakan gaya santai, dekat, dan natural untuk percakapan WhatsApp.',
    }[normalized.tone];

    const structureInstruction = {
      opening_details_cta: 'Susun jawaban dengan pembuka singkat, isi utama, lalu ajakan lanjut.',
      direct_bullets_cta: 'Susun jawaban langsung ke poin-poin penting, lalu ajakan lanjut.',
      summary_steps_cta:
        'Susun jawaban dengan ringkasan, langkah berikutnya bila relevan, lalu ajakan lanjut.',
    }[normalized.structure];

    const ctaInstruction = {
      ask_need: 'Tutup dengan pertanyaan ringan untuk memahami kebutuhan pelanggan.',
      invite_booking: 'Tutup dengan ajakan booking atau daftar bila informasinya sudah cukup.',
      offer_admin: 'Tutup dengan menawarkan bantuan admin bila pelanggan perlu dibantu langsung.',
    }[normalized.ctaStyle];

    return [
      'Anda adalah admin chat WhatsApp yang membantu pelanggan berdasarkan knowledge aktif.',
      toneInstruction,
      lengthInstruction,
      structureInstruction,
      ctaInstruction,
      'Jangan mengarang harga, jadwal, kebijakan, atau fakta yang tidak ada di knowledge.',
    ].join(' ');
  }

  private buildFlow(flow: AssistantFlowDraft, profile: TrainingProfile, format?: TrainingFormat) {
    const nextFlow = JSON.parse(JSON.stringify(flow)) as AssistantFlowDraft;
    nextFlow.profile.assistantName = this.sanitizeString(profile.assistantName) || 'Admin AI';
    nextFlow.profile.businessContext = this.buildBusinessContext(profile);
    nextFlow.profile.greetingMessage =
      this.sanitizeString(profile.greetingMessage) ||
      'Halo kak, saya siap bantu. Silakan kirim pertanyaannya ya.';
    nextFlow.profile.fallbackMessage =
      this.sanitizeString(profile.fallbackMessage) ||
      'Maaf kak, saya belum menemukan jawaban yang pas dari data yang aktif. Boleh ditulis lebih detail?';
    nextFlow.profile.clarifyMessage =
      this.sanitizeString(profile.clarifyMessage) ||
      'Supaya saya bisa bantu lebih tepat, boleh dijelaskan sedikit lebih detail ya kak?';
    nextFlow.profile.thanksMessage =
      nextFlow.profile.thanksMessage ||
      'Sama-sama kak. Kalau masih ada yang ingin ditanyakan, saya siap bantu lagi ya.';
    nextFlow.profile.menuEnabled = false;
    nextFlow.profile.menuItems = [];
    nextFlow.advanced.systemPrompt = this.buildSystemPrompt(format);

    const answerAction = nextFlow.actions.find((action) => action.type === 'answer_from_knowledge');
    if (answerAction) {
      answerAction.messageTemplate = this.normalizeFormat(format).answerPrefix;
    }

    return nextFlow;
  }

  private async saveKnowledge(tenantId: number, input: AiTrainingSaveInput) {
    const existingArticles = await this.knowledgeService.list(tenantId);
    const changedIds: number[] = [];

    for (const id of Array.isArray(input.removedKnowledgeIds) ? input.removedKnowledgeIds : []) {
      if (Number.isInteger(Number(id)) && Number(id) > 0) {
        await this.knowledgeService.deleteArticle(tenantId, Number(id));
      }
    }

    const upsertSection = async (section: TrainingKnowledgeSection) => {
      const title = this.sanitizeString(section.title);
      const content = this.sanitizeString(section.content);
      if (!title || !content) return;

      const existing =
        section.id && Number.isInteger(Number(section.id))
          ? existingArticles.find((item) => item.id === Number(section.id))
          : existingArticles.find((item) => this.normalizeTitle(item.title) === this.normalizeTitle(title));
      const payload = {
        title,
        content: this.htmlFromPlainText(content),
      };

      if (existing) {
        const updated = await this.knowledgeService.updateArticle(tenantId, existing.id, payload);
        changedIds.push(updated.id);
      } else {
        const created = await this.knowledgeService.createArticle(tenantId, payload);
        changedIds.push(created.id);
      }
    };

    for (const section of Array.isArray(input.knowledgeSections) ? input.knowledgeSections : []) {
      await upsertSection(section);
    }

    for (const section of Array.isArray(input.customKnowledgeSections) ? input.customKnowledgeSections : []) {
      await upsertSection(section);
    }

    const reindex = changedIds.length
      ? await this.knowledgeService.reindex(tenantId, changedIds)
      : { ok: true, results: [] };

    return { changedIds, reindex };
  }

  @Get()
  async getTraining(
    @Req() request: { user?: SessionPayload },
    @Query('tenantId') requestedTenantId?: string,
  ) {
    const tenantId = this.resolveTenantId(request, requestedTenantId);
    const [config, articles] = await Promise.all([
      this.ragConfigService.getForTenant(tenantId),
      this.knowledgeService.list(tenantId),
    ]);

    const articleByTitle = new Map(
      articles.map((article) => [this.normalizeTitle(article.title), article]),
    );
    const defaultTitles = new Set(defaultKnowledgeSections.map((section) => this.normalizeTitle(section.title)));
    const parsedProfile = this.parseBusinessContext(
      config.assistantFlow.profile.businessContext || config.config.businessContext,
      request.user?.tenantName || '',
    );
    const answerAction = config.assistantFlow.actions.find((action) => action.type === 'answer_from_knowledge');

    return {
      profile: {
        businessName: parsedProfile.businessName,
        assistantName: config.assistantFlow.profile.assistantName || config.config.assistantName,
        businessContext: parsedProfile.businessContext,
        greetingMessage:
          config.assistantFlow.profile.greetingMessage || config.config.greetingMessage,
        clarifyMessage:
          config.assistantFlow.profile.clarifyMessage || config.config.clarifyMessage,
        fallbackMessage:
          config.assistantFlow.profile.fallbackMessage || config.config.fallbackMessage,
      },
      format: {
        length: 'medium',
        tone: 'friendly',
        structure: 'opening_details_cta',
        ctaStyle: 'ask_need',
        answerPrefix: answerAction?.messageTemplate || 'Saya bantu cek informasinya ya kak.',
      },
      knowledgeSections: defaultKnowledgeSections.map((section) => {
        const article = articleByTitle.get(this.normalizeTitle(section.title));
        return {
          ...section,
          id: article?.id ?? null,
          content: article ? this.plainTextFromHtml(article.content) : '',
          status: article?.status ?? null,
        };
      }),
      customKnowledgeSections: articles
        .filter((article) => !defaultTitles.has(this.normalizeTitle(article.title)))
        .map((article) => ({
          key: `custom-${article.id}`,
          id: article.id,
          title: article.title,
          content: this.plainTextFromHtml(article.content),
          group: 'custom',
          status: article.status,
        })),
    };
  }

  private async persistTraining(tenantId: number, body: AiTrainingSaveInput) {
    const current = await this.ragConfigService.getForTenant(tenantId);
    const profile = body.profile || {};
    const nextFlow = this.buildFlow(current.assistantFlow, profile, body.format);

    const updatedConfig = await this.ragConfigService.updateForTenant(tenantId, {
      assistantName: nextFlow.profile.assistantName,
      businessContext: nextFlow.profile.businessContext,
      greetingMessage: nextFlow.profile.greetingMessage,
      clarifyMessage: nextFlow.profile.clarifyMessage,
      fallbackMessage: nextFlow.profile.fallbackMessage,
      thanksMessage: nextFlow.profile.thanksMessage,
      systemPrompt: nextFlow.advanced.systemPrompt,
    });
    const updatedFlow = await this.ragConfigService.updateAssistantFlowForTenant(tenantId, nextFlow);
    const knowledge = await this.saveKnowledge(tenantId, body || {});

    return {
      ok: true,
      config: updatedConfig.config,
      assistantFlow: updatedFlow.assistantFlow,
      knowledge,
    };
  }

  @Patch()
  async saveTraining(
    @Req() request: { user?: SessionPayload },
    @Body() body: AiTrainingSaveInput,
    @Query('tenantId') requestedTenantId?: string,
  ) {
    const tenantId = this.resolveTenantId(request, requestedTenantId);
    return this.persistTraining(tenantId, body || {});
  }

  @Post('test')
  async testTraining(
    @Req() request: { user?: SessionPayload },
    @Body()
    body: {
      question?: string;
      history?: ConversationTurn[];
      saveBeforeTest?: AiTrainingSaveInput;
    },
    @Query('tenantId') requestedTenantId?: string,
  ) {
    const tenantId = this.resolveTenantId(request, requestedTenantId);

    const question = this.ragConfigService.validateTestQuestion(String(body.question || ''));
    const saveResult = body.saveBeforeTest
      ? await this.persistTraining(tenantId, body.saveBeforeTest)
      : null;
    const debug = await this.ragService.test({
      tenantId,
      question,
      history: Array.isArray(body.history) ? body.history : [],
      configOverride: {},
    });

    return {
      ...debug,
      reindex: saveResult?.knowledge.reindex ?? null,
    };
  }

  private assertOwnTenant(request: { user?: SessionPayload }, tenantId: number) {
    if (request.user?.role !== UserRole.platform_admin && request.user?.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant target tidak sesuai dengan user saat ini');
    }
  }
}
