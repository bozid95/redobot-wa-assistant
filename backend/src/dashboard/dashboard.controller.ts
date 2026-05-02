import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { SessionPayload } from '../common/auth.guard';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async overview(
    @CurrentUser() user: SessionPayload,
    @Query('conversationPage') conversationPage?: string,
    @Query('conversationLimit') conversationLimit?: string,
    @Query('fallbackPage') fallbackPage?: string,
    @Query('fallbackLimit') fallbackLimit?: string,
  ) {
    return this.dashboardService.overview(user, {
      conversationPage,
      conversationLimit,
      fallbackPage,
      fallbackLimit,
    });
  }
}
