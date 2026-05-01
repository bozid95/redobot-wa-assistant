import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { SessionPayload } from '../common/auth.guard';

@Controller('whatsapp/instance')
@UseGuards(AuthGuard)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get()
  async getInstance(@CurrentUser() user: SessionPayload) {
    return this.whatsappService.getInstance(user.tenantId ?? 0);
  }

  @Post('connect')
  async connect(@CurrentUser() user: SessionPayload) {
    return this.whatsappService.connectInstance(user.tenantId ?? 0);
  }

  @Post('reconnect')
  async reconnect(@CurrentUser() user: SessionPayload) {
    return this.whatsappService.connectInstance(user.tenantId ?? 0);
  }

  @Post('disconnect')
  async disconnectInstance(@CurrentUser() user: SessionPayload) {
    return this.whatsappService.disconnectInstance(user.tenantId ?? 0);
  }
}
