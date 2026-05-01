import { Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../common/auth.guard';

@Controller('leads')
@UseGuards(AuthGuard)
export class LeadsController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async list() {
    return this.dashboardService.listLeads();
  }

  @Patch(':id/close')
  async close(@Param('id', ParseIntPipe) id: number) {
    return this.dashboardService.closeLead(id);
  }
}
