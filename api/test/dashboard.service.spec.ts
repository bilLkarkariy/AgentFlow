import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { Metric } from '../src/modules/dashboard/metric.entity';

describe('DashboardService', () => {
  let service: DashboardService;
  let repo: Partial<Repository<Metric>>;

  beforeEach(async () => {
    const mockQB: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { date: '2025-04-20', executionsCount: '2' },
        { date: '2025-04-21', executionsCount: '3' },
      ]),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQB),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Metric), useValue: repo },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
  });

  it('calculates ROI stats correctly', async () => {
    process.env.TIME_SAVED_PER_RUN = '10';
    const stats = await service.getRoiStats('2025-04-20', '2025-04-21');
    expect(stats).toEqual([
      { date: '2025-04-20', executionsCount: 2, timeSavedMinutes: 20 },
      { date: '2025-04-21', executionsCount: 3, timeSavedMinutes: 30 },
    ]);
    expect((repo as any).createQueryBuilder).toHaveBeenCalledWith('t');
  });
});
