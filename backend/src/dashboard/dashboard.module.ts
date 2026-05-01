import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { LeadsController } from './leads.controller';

@Module({
  controllers: [DashboardController, LeadsController],
  providers: [DashboardService],
})
export class DashboardModule {}
