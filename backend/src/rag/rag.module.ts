import { Module } from '@nestjs/common';
import { RagConfigController } from './rag-config.controller';
import { RagConfigService } from './rag-config.service';
import { RagService } from './rag.service';

@Module({
  controllers: [RagConfigController],
  providers: [RagConfigService, RagService],
  exports: [RagService],
})
export class RagModule {}
