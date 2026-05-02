import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AiTrainingController } from './ai-training.controller';
import { RagConfigController } from './rag-config.controller';
import { RagConfigService } from './rag-config.service';
import { RagService } from './rag.service';

@Module({
  imports: [KnowledgeModule],
  controllers: [RagConfigController, AiTrainingController],
  providers: [RagConfigService, RagService],
  exports: [RagService],
})
export class RagModule {}
