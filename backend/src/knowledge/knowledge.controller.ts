import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { SessionPayload } from '../common/auth.guard';
import { hasPaginationQuery } from '../common/pagination.util';

@Controller('knowledge')
@UseGuards(AuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async list(
    @CurrentUser() user: SessionPayload,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query = { search, page, limit };
    if (hasPaginationQuery(query)) {
      return this.knowledgeService.listPaginated(user.tenantId ?? 0, query);
    }

    return this.knowledgeService.list(user.tenantId ?? 0);
  }

  @Post()
  async create(@CurrentUser() user: SessionPayload, @Body() body: { title?: string; content?: string }) {
    if (!String(body.title || '').trim() || !String(body.content || '').trim()) {
      throw new BadRequestException('Title dan content wajib diisi');
    }

    const source = await this.knowledgeService.createArticle(user.tenantId ?? 0, {
      title: String(body.title || ''),
      content: String(body.content || ''),
    });

    const reindexResult = await this.knowledgeService.reindex(user.tenantId ?? 0, [source.id]);
    const refreshed = await this.knowledgeService.getById(user.tenantId ?? 0, source.id);

    return {
      source: refreshed,
      reindex: reindexResult,
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: SessionPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string; content?: string },
  ) {
    if (!String(body.title || '').trim() || !String(body.content || '').trim()) {
      throw new BadRequestException('Title dan content wajib diisi');
    }

    const source = await this.knowledgeService.updateArticle(user.tenantId ?? 0, id, {
      title: String(body.title || ''),
      content: String(body.content || ''),
    });

    const reindexResult = await this.knowledgeService.reindex(user.tenantId ?? 0, [source.id]);
    const refreshed = await this.knowledgeService.getById(user.tenantId ?? 0, source.id);

    return {
      source: refreshed,
      reindex: reindexResult,
    };
  }

  @Post('reindex')
  async reindex(@CurrentUser() user: SessionPayload, @Body() body: { ids?: number[] }) {
    return this.knowledgeService.reindex(user.tenantId ?? 0, body.ids);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: SessionPayload, @Param('id', ParseIntPipe) id: number) {
    return this.knowledgeService.deleteArticle(user.tenantId ?? 0, id);
  }
}
