import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async list(status?: string, search?: string) {
    return this.prisma.conversation.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(search
          ? {
              OR: [
                { phone: { contains: search } },
                { customerName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getOne(id: number) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async getMessages(id: number) {
    await this.getOne(id);
    return this.prisma.conversationMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async setTakeover(id: number, enabled: boolean) {
    const conversation = await this.getOne(id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        takeoverEnabled: enabled,
        status: enabled ? 'takeover' : 'open',
      },
    });

    await this.prisma.conversationMessage.create({
      data: {
        conversationId: id,
        phone: conversation.phone,
        role: 'system',
        source: 'takeover',
        message: enabled ? 'Takeover diaktifkan oleh admin.' : 'Takeover dilepas. Bot aktif kembali.',
        metadata: {},
      },
    });

    return updated;
  }

  async manualReply(id: number, reply: string) {
    const conversation = await this.getOne(id);
    await this.prisma.conversation.update({
      where: { id },
      data: {
        takeoverEnabled: true,
        status: 'takeover',
        lastMessageAt: new Date(),
      },
    });

    const payload = await this.whatsappService.sendText(conversation.phone, reply);

    await this.prisma.conversationMessage.create({
      data: {
        conversationId: id,
        phone: conversation.phone,
        role: 'admin',
        source: 'manual_reply',
        message: reply,
        metadata: payload,
      },
    });

    return { ok: true };
  }
}
