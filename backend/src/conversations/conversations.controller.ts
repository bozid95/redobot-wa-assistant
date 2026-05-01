import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { SessionPayload } from '../common/auth.guard';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async list(
    @CurrentUser() user: SessionPayload,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.conversationsService.list(user, status, search);
  }

  @Get(':id')
  async getOne(@CurrentUser() user: SessionPayload, @Param('id', ParseIntPipe) id: number) {
    return this.conversationsService.getOne(user, id);
  }

  @Get(':id/messages')
  async getMessages(@CurrentUser() user: SessionPayload, @Param('id', ParseIntPipe) id: number) {
    return this.conversationsService.getMessages(user, id);
  }

  @Post(':id/takeover')
  async takeover(@CurrentUser() user: SessionPayload, @Param('id', ParseIntPipe) id: number) {
    return this.conversationsService.setTakeover(user, id, true);
  }

  @Post(':id/release')
  async release(@CurrentUser() user: SessionPayload, @Param('id', ParseIntPipe) id: number) {
    return this.conversationsService.setTakeover(user, id, false);
  }

  @Post(':id/reply')
  async reply(
    @CurrentUser() user: SessionPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reply?: string },
  ) {
    return this.conversationsService.manualReply(user, id, String(body.reply || '').trim());
  }
}
