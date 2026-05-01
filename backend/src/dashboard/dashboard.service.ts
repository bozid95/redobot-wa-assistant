import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [instance, chatsToday, fallbackToday, takeoverActive, openLeads] = await Promise.all([
      this.prisma.waInstance.findFirst({ orderBy: { updatedAt: 'desc' } }),
      this.prisma.conversationMessage.count({
        where: { role: 'user', createdAt: { gte: startOfDay } },
      }),
      this.prisma.unansweredLead.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      this.prisma.conversation.count({
        where: { takeoverEnabled: true },
      }),
      this.prisma.unansweredLead.count({
        where: { status: 'open' },
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

  async listLeads() {
    return this.prisma.unansweredLead.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async closeLead(id: number) {
    return this.prisma.unansweredLead.update({
      where: { id },
      data: { status: 'closed' },
    });
  }
}
