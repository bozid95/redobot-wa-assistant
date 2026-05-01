import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { AuthGuard } from '../common/auth.guard';

@Controller('knowledge')
@UseGuards(AuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async list() {
    return this.knowledgeService.list();
  }

  @Post()
  async create(@Body() body: { title?: string; content?: string }) {
    if (!String(body.title || '').trim() || !String(body.content || '').trim()) {
      throw new BadRequestException('Title dan content wajib diisi');
    }

    const source = await this.knowledgeService.createArticle({
      title: String(body.title || ''),
      content: String(body.content || ''),
    });

    const reindexResult = await this.knowledgeService.reindex([source.id]);
    const refreshed = await this.knowledgeService.getById(source.id);

    return {
      source: refreshed,
      reindex: reindexResult,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string; content?: string },
  ) {
    if (!String(body.title || '').trim() || !String(body.content || '').trim()) {
      throw new BadRequestException('Title dan content wajib diisi');
    }

    const source = await this.knowledgeService.updateArticle(id, {
      title: String(body.title || ''),
      content: String(body.content || ''),
    });

    const reindexResult = await this.knowledgeService.reindex([source.id]);
    const refreshed = await this.knowledgeService.getById(source.id);

    return {
      source: refreshed,
      reindex: reindexResult,
    };
  }

  @Post('reindex')
  async reindex(@Body() body: { ids?: number[] }) {
    return this.knowledgeService.reindex(body.ids);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.knowledgeService.deleteArticle(id);
  }
}
