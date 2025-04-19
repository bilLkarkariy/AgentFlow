import { QuotaReporterService } from '../src/modules/stripe/quota-reporter.service';
import { Repository } from 'typeorm';
import { TaskRun } from '../src/modules/tasks/task-run.entity';
import { StripeService } from '../src/modules/stripe/stripe.service';

describe('QuotaReporterService', () => {
  let service: QuotaReporterService;
  let repo: jest.Mocked<Repository<TaskRun>>;
  let stripe: jest.Mocked<StripeService>;

  beforeEach(() => {
    // Use unknown to force-cast partial mocks
    repo = ({ find: jest.fn() } as unknown) as jest.Mocked<Repository<TaskRun>>;
    stripe = ({ createUsageRecord: jest.fn() } as unknown) as jest.Mocked<StripeService>;
    service = new QuotaReporterService(repo, stripe);
  });

  it('should report aggregated usage', async () => {
    const runs: TaskRun[] = [
      Object.assign(new TaskRun(), { subscriptionItemId: 'sub1', executedAt: new Date() }),
      Object.assign(new TaskRun(), { subscriptionItemId: 'sub1', executedAt: new Date() }),
      Object.assign(new TaskRun(), { subscriptionItemId: 'sub2', executedAt: new Date() }),
    ];
    repo.find.mockResolvedValue(runs);
    await service.reportDailyUsage();
    expect(stripe.createUsageRecord).toHaveBeenCalledTimes(2);
    expect(stripe.createUsageRecord).toHaveBeenCalledWith('sub1', 2);
    expect(stripe.createUsageRecord).toHaveBeenCalledWith('sub2', 1);
  });

  it('should not call createUsageRecord when no runs', async () => {
    repo.find.mockResolvedValue([]);
    await service.reportDailyUsage();
    expect(stripe.createUsageRecord).toHaveBeenCalledTimes(0);
  });

  it('should aggregate large volume correctly', async () => {
    const runs: TaskRun[] = [];
    for (let i = 0; i < 5; i++) {
      runs.push(Object.assign(new TaskRun(), { subscriptionItemId: 'big1', executedAt: new Date() }));
    }
    for (let i = 0; i < 3; i++) {
      runs.push(Object.assign(new TaskRun(), { subscriptionItemId: 'big2', executedAt: new Date() }));
    }
    repo.find.mockResolvedValue(runs);
    await service.reportDailyUsage();
    expect(stripe.createUsageRecord).toHaveBeenCalledTimes(2);
    expect(stripe.createUsageRecord).toHaveBeenCalledWith('big1', 5);
    expect(stripe.createUsageRecord).toHaveBeenCalledWith('big2', 3);
  });
});
