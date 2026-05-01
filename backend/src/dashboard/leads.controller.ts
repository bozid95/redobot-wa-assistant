import { Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { SessionPayload } from '../common/auth.guard';

@Controller('leads')
@UseGuards(AuthGuard)
export class LeadsController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async list(@CurrentUser() user: SessionPayload) {
    return this.dashboardService.listLeads(user);
  }

  @Patch(':id/close')
  async close(@CurrentUser() user: SessionPayload, @Param('id', ParseIntPipe) id: number) {
    await this.dashboardService.closeLead(user, id);
    return { ok: true };
  }
}
