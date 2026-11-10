import { RabbitMQService } from './rabbitmq.service';

describe('RabbitMQService.subscribe (durable queue)', () => {
  let service: RabbitMQService;
  let channel: any;
  let deliver: (msg: any) => Promise<void>;

  const message = (event: string, payload: unknown) => ({
    content: Buffer.from(JSON.stringify({ event, payload })),
  });

  beforeEach(() => {
    channel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation(async (_queue, onMessage) => { deliver = onMessage; }),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    service = new RabbitMQService();
    (service as any).channel = channel;
  });

  it('acknowledges a message only once its handler has settled', async () => {
    let finish: () => void;
    const handler = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    await service.subscribe('flow.run', handler, { queue: 'agentflow.flow-run' });

    const msg = message('flow.run', { runId: 'r1' });
    const delivered = deliver(msg);
    await new Promise(setImmediate);
    expect(handler).toHaveBeenCalledWith({ runId: 'r1' });
    // The handler is still running: the broker must keep the message.
    expect(channel.ack).not.toHaveBeenCalled();

    finish();
    await delivered;
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('rejects the message when the handler fails', async () => {
    await service.subscribe('flow.run', async () => { throw new Error('boom'); }, { queue: 'q' });
    const msg = message('flow.run', {});
    await deliver(msg);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  });

  it('holds one message at a time by default, `prefetch` when given', async () => {
    await service.subscribe('flow.run', jest.fn(), { queue: 'q' });
    await service.subscribe('flow.run', jest.fn(), { queue: 'q', prefetch: 5 });
    expect(channel.prefetch.mock.calls).toEqual([[1], [5]]);
  });
});
