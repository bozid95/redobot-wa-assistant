import { Body, Controller, Param, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('evolution/:instanceName')
  async evolutionByInstance(@Param('instanceName') instanceName: string, @Body() body: any) {
    return this.webhooksService.handleEvolutionWebhook(body, instanceName);
  }

  @Post('evolution')
  async evolution(@Body() body: any) {
    return this.webhooksService.handleEvolutionWebhook(body);
  }
}
