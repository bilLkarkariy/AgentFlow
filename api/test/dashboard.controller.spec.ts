import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService, RoiStat } from '../src/modules/dashboard/dashboard.service';
import { BadRequestException } from '@nestjs/common';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: Partial<DashboardService>;

  beforeEach(() => {
    service = { getRoiStats: jest.fn() };
    controller = new DashboardController(service as DashboardService);
  });

  it('throws on missing params', async () => {
    await expect(controller.roi(undefined as any, undefined as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws on invalid dates', async () => {
    await expect(controller.roi('invalid', '2025-04-21')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns stats on valid dates', async () => {
    const fake: RoiStat[] = [{ date: 'd', executionsCount: 1, timeSavedMinutes: 5 }];
    (service.getRoiStats as jest.Mock).mockResolvedValue(fake);
    const res = await controller.roi('2025-04-20', '2025-04-21');
    expect(res).toBe(fake);
    expect(service.getRoiStats).toHaveBeenCalledWith('2025-04-20', '2025-04-21');
  });
});
