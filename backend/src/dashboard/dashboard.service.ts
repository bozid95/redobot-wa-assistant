import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionPayload } from '../common/auth.guard';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getTenantId(user: SessionPayload) {
    return user.tenantId ?? 0;
  }

  async overview(user: SessionPayload) {
    const tenantId = this.getTenantId(user);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [instance, chatsToday, fallbackToday, takeoverActive, openLeads] = await Promise.all([
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
    ]);

    return {
      instance,
      stats: {
        chatsToday,
        fallbackToday,
        takeoverActive,
        openLeads,
      },
    };
  }

  async listLeads(user: SessionPayload) {
    return this.prisma.unansweredLead.findMany({
      where: { tenantId: this.getTenantId(user) },
      orderBy: { createdAt: 'desc' },
    });
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
