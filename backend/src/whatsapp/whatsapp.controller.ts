import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { AuthGuard } from '../common/auth.guard';

@Controller('whatsapp/instance')
@UseGuards(AuthGuard)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get()
  async getInstance() {
    return this.whatsappService.getInstance();
  }

  @Post('connect')
  async connect() {
    return this.whatsappService.connectInstance();
  }

  @Post('reconnect')
  async reconnect() {
    return this.whatsappService.connectInstance();
  }

  @Post('disconnect')
  async disconnectInstance() {
    return this.whatsappService.disconnectInstance();
  }
}
