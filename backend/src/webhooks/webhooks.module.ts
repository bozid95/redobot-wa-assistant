import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { RagModule } from '../rag/rag.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [ConversationsModule, RagModule, WhatsappModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
