import { Body, Controller, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('evolution')
  async evolution(@Body() body: any) {
    return this.webhooksService.handleEvolutionWebhook(body);
  }
}
