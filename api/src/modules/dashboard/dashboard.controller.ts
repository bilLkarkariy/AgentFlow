import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('roi')
  @ApiOperation({ summary: 'Get ROI statistics for a period' })
  @ApiQuery({ name: 'from', type: String, required: true, description: 'Start date in ISO format', example: '2025-04-01' })
  @ApiQuery({ name: 'to', type: String, required: true, description: 'End date in ISO format', example: '2025-04-30' })
  @ApiResponse({ status: 200, description: 'ROI statistics' })
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
