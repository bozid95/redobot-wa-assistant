import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { SessionPayload } from '../common/auth.guard';
import { hasPaginationQuery, paginated, PaginationQuery, sanitizePagination } from '../common/pagination.util';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  private getTenantId(user: SessionPayload) {
    return user.tenantId ?? 0;
  }

  async list(user: SessionPayload, status?: string, search?: string, pagination: PaginationQuery = {}) {
    const where: Prisma.ConversationWhereInput = {
      tenantId: this.getTenantId(user),
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { phone: { contains: search } },
              { customerName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const query: Prisma.ConversationFindManyArgs = {
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    };

    if (!hasPaginationQuery(pagination)) {
      return this.prisma.conversation.findMany(query);
    }

    const { page, limit, skip, take } = sanitizePagination(pagination, 10);
    const [total, items] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({ ...query, skip, take }),
    ]);

    return paginated(items, total, page, limit);
  }

  async getOne(user: SessionPayload, id: number) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        tenantId: this.getTenantId(user),
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async getMessages(user: SessionPayload, id: number) {
    await this.getOne(user, id);
    return this.prisma.conversationMessage.findMany({
      where: {
        conversationId: id,
        tenantId: this.getTenantId(user),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async setTakeover(user: SessionPayload, id: number, enabled: boolean) {
    const conversation = await this.getOne(user, id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: {
        takeoverEnabled: enabled,
        status: enabled ? 'takeover' : 'open',
      },
    });

    await this.prisma.conversationMessage.create({
      data: {
        tenantId: this.getTenantId(user),
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

  async manualReply(user: SessionPayload, id: number, reply: string) {
    const conversation = await this.getOne(user, id);
    await this.prisma.conversation.update({
      where: { id },
      data: {
        takeoverEnabled: true,
        status: 'takeover',
        lastMessageAt: new Date(),
      },
    });

    const payload = await this.whatsappService.sendText(this.getTenantId(user), conversation.phone, reply);
    const messageId = this.whatsappService.extractMessageId(payload);

    await this.prisma.conversationMessage.create({
      data: {
        tenantId: this.getTenantId(user),
        conversationId: id,
        phone: conversation.phone,
        role: 'admin',
        source: 'manual_reply',
        message: reply,
        messageId: messageId || undefined,
        metadata: payload,
      },
    });

    return { ok: true };
  }
}
