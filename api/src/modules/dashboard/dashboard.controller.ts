import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('roi')
  async roi(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('Query params from and to are required');
    }
    // validate ISO date
    if (isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
      throw new BadRequestException('Invalid date format');
    }

    return this.svc.getRoiStats(from, to);
  }
}
