import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { RunsController } from './runs.controller';
import { TaskRun } from './task-run.entity';

describe('RunsController', () => {
  let controller: RunsController;
  let mockRepo: Partial<Repository<TaskRun>>;
  let mockQueue: { getJob: jest.Mock };

  beforeEach(async () => {
    mockRepo = { find: jest.fn(), save: jest.fn() };
    mockQueue = { getJob: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RunsController],
      providers: [
        { provide: getRepositoryToken(TaskRun), useValue: mockRepo },
        { provide: getQueueToken('agent-run'), useValue: mockQueue },
      ],
    }).compile();

    controller = module.get<RunsController>(RunsController);
  });

  it('should list runs', async () => {
    const runs = [{ id: '1' } as TaskRun];
    (mockRepo.find as jest.Mock).mockResolvedValue(runs);
    const result = await controller.list();
    expect(result).toBe(runs);
    expect(mockRepo.find).toHaveBeenCalledWith({ order: { executedAt: 'DESC' }, take: 100 });
  });

  it('should cancel existing job without error', async () => {
    const mockJob = { discard: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
    mockQueue.getJob.mockResolvedValue(mockJob);

    const res = await controller.cancel('job1');
    expect(mockQueue.getJob).toHaveBeenCalledWith('job1');
    expect(mockJob.discard).toHaveBeenCalled();
    expect(mockJob.remove).toHaveBeenCalled();
    expect(res).toEqual({ cancelled: true });
  });

  it('should handle missing job gracefully', async () => {
    mockQueue.getJob.mockResolvedValue(null);
    const res = await controller.cancel('none');
    expect(res).toEqual({ cancelled: true });
  });

  it('should swallow errors during cancel', async () => {
    const mockJob = { discard: jest.fn().mockRejectedValue(new Error('fail')), remove: jest.fn() };
    mockQueue.getJob.mockResolvedValue(mockJob);
    await expect(controller.cancel('job2')).resolves.toEqual({ cancelled: true });
    expect(mockJob.discard).toHaveBeenCalled();
  });
});
