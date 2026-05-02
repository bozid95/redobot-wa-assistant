import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

type SalesStage = 'new' | 'discovery' | 'interested' | 'hot' | 'handoff';
type IntentKey = 'price' | 'requirement' | 'schedule' | 'location' | 'registration' | 'contact';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly whatsappService: WhatsappService,
  ) {}

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private readonly leadIntentPatterns: Record<IntentKey, RegExp[]> = {
    price: [/\b(harga|biaya|tarif|ongkos|bayar|dp|pembayaran)\b/i],
    requirement: [/\b(syarat|persyaratan|dokumen|berkas|ktp|minimal umur|usia)\b/i],
    schedule: [/\b(jadwal|jam|hari|weekend|operasional|buka)\b/i],
    location: [/\b(alamat|lokasi|maps|map|kantor|tempat)\b/i],
    registration: [/\b(daftar|pendaftaran|registrasi|cara daftar|mau daftar|join|booking)\b/i],
    contact: [/\b(admin|cs|kontak|nomor|telepon|wa|whatsapp|hubungi)\b/i],
  };

  private detectIntents(text: string) {
    return (Object.entries(this.leadIntentPatterns) as Array<[IntentKey, RegExp[]]>)
      .filter(([, patterns]) => patterns.some((pattern) => pattern.test(text)))
      .map(([intent]) => intent);
  }

  private calculateLeadDelta(intents: IntentKey[], question: string) {
    let delta = 0;
    if (intents.includes('price')) delta += 2;
    if (intents.includes('requirement')) delta += 2;
    if (intents.includes('schedule')) delta += 2;
    if (intents.includes('location')) delta += 1;
    if (intents.includes('registration')) delta += 4;
    if (intents.includes('contact')) delta += 3;
    if (/\b(mau|ingin|tertarik|siap|lanjut)\b/i.test(question)) delta += 2;
    return delta;
  }

  private resolveLeadStage(score: number, intents: IntentKey[]): SalesStage {
    if (score >= 10 || intents.includes('contact')) return 'handoff';
    if (score >= 7 || intents.includes('registration')) return 'hot';
    if (score >= 4) return 'interested';
    if (score >= 1) return 'discovery';
    return 'new';
  }

  private looksLikePaymentProof(question: string, message: any) {
    const lower = question.toLowerCase();
    const hasMedia = Boolean(
      message.imageMessage ||
      message.documentMessage ||
      message.videoMessage,
    );

    return hasMedia || /\b(sudah transfer|sudah bayar|bukti bayar|bukti transfer|transfer ya|saya transfer)\b/i.test(lower);
  }

  async handleEvolutionWebhook(input: any, routeInstanceName?: string) {
    const payload = input?.body ?? input ?? {};
    const data = payload.data ?? payload;
    const key = data.key ?? payload.key ?? {};
    const message = data.message ?? payload.message ?? {};
    const instanceName = String(
      routeInstanceName ||
      payload.instanceName ||
      data.instanceName ||
      payload.instance ||
      data.instance ||
      '',
    ).trim();

    const text =
      message.conversation ??
      message.extendedTextMessage?.text ??
      message.extendedtextmessage?.text ??
      message.imageMessage?.caption ??
      message.documentMessage?.caption ??
      message.videoMessage?.caption ??
      '';

    const remoteJid = String(key.remoteJid ?? data.remoteJid ?? payload.remoteJid ?? '').trim();
    const phone = remoteJid.replace(/\D/g, '');
    const messageId = String(key.id ?? data.id ?? payload.id ?? '');
    const fromMe = Boolean(key.fromMe ?? data.fromMe ?? false);
    const isGroup = remoteJid.endsWith('@g.us');
    const question = String(text || '').trim();
    const normalizedText = question.replace(/\s+/g, ' ').toLowerCase();
    const pushName = String(data.pushName ?? payload.pushName ?? '').trim() || null;

    if (fromMe || isGroup || !phone || !messageId || !question) {
      return { ignored: true };
    }

    const instance = await this.whatsappService.getInstanceByName(instanceName);
    if (!instance?.tenantId) {
      return { ignored: true, reason: 'unknown_instance' };
    }

    const tenantId = instance.tenantId;

    try {
      await this.prisma.processedMessage.create({
        data: { tenantId, messageId, phone },
      });
    } catch {
      return { deduplicated: true };
    }

    const intents = this.detectIntents(question);

    const conversation = await this.prisma.conversation.upsert({
      where: {
        tenantId_phone: {
          tenantId,
          phone,
        },
      },
      update: {
        customerName: pushName ?? undefined,
        lastMessageAt: new Date(),
      },
      create: {
        tenantId,
        phone,
        customerName: pushName,
      },
    });

    const leadDelta = this.calculateLeadDelta(intents, question);
    const nextLeadScore = Math.max(0, (conversation.leadScore || 0) + leadDelta);
    const nextLeadStage = this.resolveLeadStage(nextLeadScore, intents);
    const shouldOfferHandoff = nextLeadStage === 'hot' || nextLeadStage === 'handoff';

    await this.prisma.conversationMessage.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        phone,
        role: 'user',
        source: 'evolution',
        message: question,
        messageId,
        metadata: {
          push_name: pushName,
        },
      },
    });

    if (conversation.takeoverEnabled) {
      return { ok: true, mode: 'takeover' };
    }

    if (conversation.paymentRequested && !conversation.paymentProofReceived && this.looksLikePaymentProof(question, message)) {
      const confirmationReply = 'Siap kak, bukti bayar sudah saya terima dan data kakak sudah kami simpan. Admin akan lanjut cek pembayaran dan menghubungi kakak untuk konfirmasi berikutnya ya.';
      const responsePayload = await this.whatsappService.sendText(tenantId, phone, confirmationReply);
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          paymentProofReceived: true,
          handoffSuggested: true,
          leadStage: 'handoff',
          lastMessageAt: new Date(),
        },
      });
      await this.prisma.conversationMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          phone,
          role: 'assistant',
          source: 'rag',
          message: confirmationReply,
          metadata: this.toJsonValue({
            payment_proof_received: true,
            transport: responsePayload,
          }),
        },
      });
      return { ok: true, mode: 'payment-proof-received' };
    }

    const recentMessages = await this.prisma.conversationMessage.findMany({
      where: {
        tenantId,
        conversationId: conversation.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    const history = recentMessages
      .reverse()
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({
        role: item.role as 'user' | 'assistant',
        message: item.message,
      }));

    const ragResult = await this.ragService.generate(question, normalizedText, history, {
      tenantId,
      leadStage: nextLeadStage,
      leadScore: nextLeadScore,
      shouldOfferHandoff,
      detectedIntents: intents,
      knownPhone: phone,
    });

    if (ragResult.action === 'answer') {
      const responsePayload = await this.whatsappService.sendText(tenantId, phone, ragResult.reply);
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          leadScore: nextLeadScore,
          leadStage: nextLeadStage,
          handoffSuggested: shouldOfferHandoff,
          paymentRequested: Boolean((ragResult.metadata as any)?.payment_requested) || conversation.paymentRequested,
        },
      });
      await this.prisma.conversationMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          phone,
          role: 'assistant',
          source: ragResult.source,
          message: ragResult.reply,
          metadata: this.toJsonValue({
            ...ragResult.metadata,
            transport: responsePayload,
          }),
        },
      });
      return { ok: true, mode: 'auto-reply' };
    }

    const responsePayload = await this.whatsappService.sendText(tenantId, phone, ragResult.reply);
    await this.prisma.unansweredLead.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        phone,
        question,
        reason: ragResult.reason,
        metadata: this.toJsonValue({
          ...ragResult.metadata,
          lead_stage: nextLeadStage,
          lead_score: nextLeadScore,
        }),
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        leadScore: nextLeadScore,
        leadStage: nextLeadStage,
        handoffSuggested: shouldOfferHandoff,
      },
    });
    await this.prisma.conversationMessage.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        phone,
        role: 'assistant',
        source: 'fallback',
        message: ragResult.reply,
        metadata: this.toJsonValue({
          ...ragResult.metadata,
          transport: responsePayload,
        }),
      },
    });
    return { ok: true, mode: 'fallback' };
  }
}
