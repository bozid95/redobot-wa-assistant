import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionPayload } from '../common/auth.guard';
import { hasPaginationQuery, paginated, PaginationQuery, sanitizePagination } from '../common/pagination.util';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getTenantId(user: SessionPayload) {
    return user.tenantId ?? 0;
  }

  private sanitizePage(value: unknown) {
    const parsed = Number(value || 1);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  }

  private sanitizeLimit(value: unknown, fallback: number) {
    const parsed = Number(value || fallback);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 20) : fallback;
  }

  private buildPagination(total: number, page: number, limit: number) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      page,
      limit,
      total,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    };
  }

  async overview(
    user: SessionPayload,
    pagination: {
      conversationPage?: string;
      conversationLimit?: string;
      fallbackPage?: string;
      fallbackLimit?: string;
    } = {},
  ) {
    const tenantId = this.getTenantId(user);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const conversationPage = this.sanitizePage(pagination.conversationPage);
    const conversationLimit = this.sanitizeLimit(pagination.conversationLimit, 5);
    const fallbackPage = this.sanitizePage(pagination.fallbackPage);
    const fallbackLimit = this.sanitizeLimit(pagination.fallbackLimit, 3);

    const [
      instance,
      chatsToday,
      fallbackToday,
      takeoverActive,
      openLeads,
      recentConversationsTotal,
      recentConversations,
      recentFallbacksTotal,
      recentFallbacks,
      knowledgeTotal,
      knowledgeIndexed,
      knowledgePending,
      knowledgeError,
    ] = await Promise.all([
      this.prisma.waInstance.findUnique({ where: { tenantId } }),
      this.prisma.conversationMessage.count({
        where: { tenantId, role: 'user', createdAt: { gte: startOfDay } },
      }),
      this.prisma.unansweredLead.count({
        where: { tenantId, createdAt: { gte: startOfDay } },
      }),
      this.prisma.conversation.count({
        where: { tenantId, takeoverEnabled: true },
      }),
      this.prisma.unansweredLead.count({
        where: { tenantId, status: 'open' },
      }),
      this.prisma.conversation.count({
        where: { tenantId },
      }),
      this.prisma.conversation.findMany({
        where: { tenantId },
        orderBy: { lastMessageAt: 'desc' },
        skip: (conversationPage - 1) * conversationLimit,
        take: conversationLimit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.unansweredLead.count({
        where: { tenantId, status: 'open' },
      }),
      this.prisma.unansweredLead.findMany({
        where: { tenantId, status: 'open' },
        orderBy: { createdAt: 'desc' },
        skip: (fallbackPage - 1) * fallbackLimit,
        take: fallbackLimit,
      }),
      this.prisma.knowledgeSource.count({ where: { tenantId } }),
      this.prisma.knowledgeSource.count({ where: { tenantId, status: 'indexed' } }),
      this.prisma.knowledgeSource.count({ where: { tenantId, status: 'pending' } }),
      this.prisma.knowledgeSource.count({ where: { tenantId, status: 'error' } }),
    ]);

    const connected = String(instance?.status || '').toLowerCase() === 'connected';
    const knowledgeReady = knowledgeTotal > 0 && knowledgeError === 0 && knowledgePending === 0;
    const fallbackRateOk = chatsToday === 0 ? true : fallbackToday / chatsToday <= 0.2;

    return {
      instance,
      stats: {
        chatsToday,
        fallbackToday,
        takeoverActive,
        openLeads,
      },
      recentConversations: recentConversations.map((conversation) => ({
        id: conversation.id,
        name: conversation.customerName || conversation.phone,
        phone: conversation.phone,
        status: conversation.status,
        takeoverEnabled: conversation.takeoverEnabled,
        lastMessageAt: conversation.lastMessageAt,
        message: conversation.messages[0]?.message || 'Belum ada pesan',
        lastRole: conversation.messages[0]?.role || null,
      })),
      recentConversationsPagination: this.buildPagination(
        recentConversationsTotal,
        conversationPage,
        conversationLimit,
      ),
      recentFallbacks: recentFallbacks.map((lead) => ({
        id: lead.id,
        phone: lead.phone,
        conversationId: lead.conversationId,
        question: lead.question,
        reason: lead.reason,
        status: lead.status,
        createdAt: lead.createdAt,
      })),
      recentFallbacksPagination: this.buildPagination(
        recentFallbacksTotal,
        fallbackPage,
        fallbackLimit,
      ),
      knowledge: {
        total: knowledgeTotal,
        indexed: knowledgeIndexed,
        pending: knowledgePending,
        error: knowledgeError,
        ready: knowledgeReady,
      },
      readiness: {
        whatsappConnected: connected,
        knowledgeIndexed: knowledgeReady,
        fallbackHealthy: fallbackRateOk,
      },
    };
  }

  async listLeads(user: SessionPayload, pagination: PaginationQuery = {}) {
    const where = { tenantId: this.getTenantId(user) };
    const query = {
      where,
      orderBy: { createdAt: 'desc' },
    } as const;

    if (!hasPaginationQuery(pagination)) {
      return this.prisma.unansweredLead.findMany(query);
    }

    const { page, limit, skip, take } = sanitizePagination(pagination, 10);
    const [total, items] = await Promise.all([
      this.prisma.unansweredLead.count({ where }),
      this.prisma.unansweredLead.findMany({ ...query, skip, take }),
    ]);

    return paginated(items, total, page, limit);
  }

  async closeLead(user: SessionPayload, id: number) {
    return this.prisma.unansweredLead.updateMany({
      where: {
        id,
        tenantId: this.getTenantId(user),
      },
      data: { status: 'closed' },
    });
  }
}
