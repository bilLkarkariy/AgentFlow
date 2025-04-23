import { ExecuteProcessor, ExecuteAgentJob } from '../src/modules/queues/execute.processor';
import { Repository } from 'typeorm';
import { TaskRun } from '../src/modules/tasks/task-run.entity';
import { GmailService } from '../src/modules/gmail/gmail.service';
import { Job } from 'bullmq';
import { AgentDsl } from '../src/modules/agents/dsl-parser.service';
import { FlowGateway } from 'src/modules/agents/flow/flow.gateway';

describe('ExecuteProcessor', () => {
  let processor: ExecuteProcessor;
  let mockRepo: jest.Mocked<Repository<TaskRun>>;
  let mockGmail: jest.Mocked<GmailService>;

  beforeEach(() => {
    mockRepo = { save: jest.fn() } as unknown as jest.Mocked<Repository<TaskRun>>;
    mockGmail = {} as unknown as jest.Mocked<GmailService>;
    processor = new ExecuteProcessor(mockGmail, mockRepo, {} as unknown as FlowGateway);
  });

  it('should save a TaskRun for each job execution', async () => {
    const job = {
      data: {
        agentId: 'sub1',
        dsl: {
          trigger: { type: 'gmail.new_email', filter: { from: 'a@b.com' } },
          action: { type: 'gmail.read_subject', target: 'last' },
        },
      },
    } as unknown as Job<ExecuteAgentJob>;
    await processor.process(job);
    expect(mockRepo.save).toHaveBeenCalledWith({
      subscriptionItemId: 'sub1',
      executedAt: expect.any(Date),
    });
  });

  it('should still save TaskRun even for unsupported DSL', async () => {
    const invalidDsl = { trigger: { type: 'unknown', filter: { from: 'a@b.com' } }, action: { type: 'unknown', target: 'last' } } as unknown as AgentDsl;
    const job = { data: { agentId: 'sub2', dsl: invalidDsl } } as unknown as Job<ExecuteAgentJob>;
    await processor.process(job);
    expect(mockRepo.save).toHaveBeenCalledWith({
      subscriptionItemId: 'sub2',
      executedAt: expect.any(Date),
    });
  });
});
