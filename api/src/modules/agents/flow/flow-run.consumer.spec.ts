import { Subject } from 'rxjs';
import { FlowRunConsumer } from './flow-run.consumer';
import { FlowRunStatus } from './flow-run.entity';
import { PricingService } from '../../pricing/pricing.service';

describe('FlowRunConsumer', () => {
  let consumer: FlowRunConsumer;
  let handleRun: (payload: { runId: string; input: string; agentId: string }) => Promise<void>;
  let rabbit: any;
  let run: any;
  let runRepo: any;
  let runNodeRepo: any;
  let engine: any;
  let tokens: Subject<string>;

  const flowDto = {
    nodes: [{ id: 'n1', data: { model: 'gpt-4o-mini' } }],
    edges: [],
    mappings: [],
  };
  const payload = { runId: 'run-1', input: 'hi', agentId: 'agent-1' };
  /** Let the pending promise callbacks run, and tell whether `p` is settled. */
  const isSettled = async (p: Promise<void>) => {
    let settled = false;
    p.then(() => (settled = true), () => (settled = true));
    await new Promise(setImmediate);
    return settled;
  };

  beforeEach(() => {
    tokens = new Subject<string>();
    run = { id: 'run-1', status: FlowRunStatus.PENDING };
    rabbit = { subscribe: jest.fn((_event, handler) => { handleRun = handler; }) };
    runRepo = {
      findOne: jest.fn().mockResolvedValue(run),
      save: jest.fn().mockImplementation(async (r) => r),
    };
    runNodeRepo = {
      create: jest.fn((row) => row),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    engine = { runFlow: jest.fn(() => tokens) };
    const flowLogs = { emitLog: jest.fn(), emitToken: jest.fn(), endRun: jest.fn() };
    consumer = new FlowRunConsumer(
      rabbit,
      runRepo,
      runNodeRepo,
      { getDto: jest.fn().mockResolvedValue(flowDto) } as any,
      engine,
      new PricingService(),
      flowLogs as any,
    );
    consumer.onModuleInit();
  });

  it('consumes the shared durable queue, several runs at once', () => {
    expect(rabbit.subscribe).toHaveBeenCalledWith('flow.run', expect.any(Function), {
      queue: 'agentflow.flow-run',
      prefetch: 5,
    });
  });

  it('keeps the message unacknowledged until the run has completed', async () => {
    const handled = handleRun(payload);
    expect(await isSettled(handled)).toBe(false);
    expect(run.status).toBe(FlowRunStatus.RUNNING);

    tokens.next('a');
    tokens.next('b');
    expect(await isSettled(handled)).toBe(false);

    tokens.complete();
    await handled;
    expect(run.status).toBe(FlowRunStatus.COMPLETED);
    expect(run.stats.tokens).toBe(2);
    expect(runNodeRepo.save).toHaveBeenCalledTimes(2);
  });

  it('settles a failed run as handled, with its status stored', async () => {
    const handled = handleRun(payload);
    await new Promise(setImmediate);
    tokens.error(new Error('Agent runner timeout after 30000ms'));

    await expect(handled).resolves.toBeUndefined();
    expect(run.status).toBe(FlowRunStatus.FAILED);
  });

  it('does not run a finished run again when its message is redelivered', async () => {
    run.status = FlowRunStatus.COMPLETED;
    await handleRun(payload);
    expect(engine.runFlow).not.toHaveBeenCalled();
    expect(runRepo.save).not.toHaveBeenCalled();
  });

  it('starts an interrupted run over, without the output of the dead attempt', async () => {
    run.status = FlowRunStatus.RUNNING;
    const handled = handleRun(payload);
    await new Promise(setImmediate);
    tokens.complete();
    await handled;

    expect(runNodeRepo.delete).toHaveBeenCalledWith({ run: { id: 'run-1' } });
    expect(engine.runFlow).toHaveBeenCalledTimes(1);
    expect(run.status).toBe(FlowRunStatus.COMPLETED);
  });

  it('rejects, so the message is not acknowledged, when the final status cannot be stored', async () => {
    const handled = handleRun(payload);
    await new Promise(setImmediate);
    runRepo.save.mockRejectedValueOnce(new Error('database is down'));
    tokens.complete();
    await expect(handled).rejects.toThrow('database is down');
  });
});
