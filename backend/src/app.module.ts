import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ConversationsModule } from './conversations/conversations.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { RagModule } from './rag/rag.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RolesGuard } from './common/roles.guard';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    WhatsappModule,
    ConversationsModule,
    DashboardModule,
    KnowledgeModule,
    RagModule,
    WebhooksModule,
    TenantsModule,
    UsersModule,
  ],
  providers: [RolesGuard],
})
export class AppModule {}
