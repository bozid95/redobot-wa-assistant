import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '../common/auth.guard';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async list(@Query('status') status?: string, @Query('search') search?: string) {
    return this.conversationsService.list(status, search);
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.conversationsService.getOne(id);
  }

  @Get(':id/messages')
  async getMessages(@Param('id', ParseIntPipe) id: number) {
    return this.conversationsService.getMessages(id);
  }

  @Post(':id/takeover')
  async takeover(@Param('id', ParseIntPipe) id: number) {
    return this.conversationsService.setTakeover(id, true);
  }

  @Post(':id/release')
  async release(@Param('id', ParseIntPipe) id: number) {
    return this.conversationsService.setTakeover(id, false);
  }

  @Post(':id/reply')
  async reply(@Param('id', ParseIntPipe) id: number, @Body() body: { reply?: string }) {
    return this.conversationsService.manualReply(id, String(body.reply || '').trim());
  }
}
