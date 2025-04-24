import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/modules/app.module';
import { Server } from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { FlowLogsGateway } from '../src/modules/flow-logs/flow-logs.gateway';
import { IoAdapter } from '@nestjs/platform-socket.io';

// increase timeout for WebSocket tests
jest.setTimeout(30000);

describe('Flow logs e2e', () => {
  let app: INestApplication;
  let server: Server;
  let httpServerAddr: string;

  beforeAll(async () => {
    process.env.JEST_WORKER_ID = '1';
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // register Socket.IO adapter
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);
    server = app.getHttpServer();
    const address = server.address() as any;
    httpServerAddr = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should stream log event over websocket', async () => {
    const runId = 'test-run-1';

    // create ws client
    const client: ClientSocket = ClientIO(`${httpServerAddr}/ws/flow`, {
      transports: ['websocket'],
    });

    // wait until connected
    await new Promise<void>((resolve) => client.on('connect', () => resolve()));

    // join room and wait for ack
    await new Promise<void>((resolve) => {
      client.emit('join', { runId }, (ack: any) => {
        console.log('[FlowLogsGateway Test] join ack', ack);
        resolve();
      });
    });

    const promise = new Promise<string>((resolve) => {
      client.on('log', (payload: any) => {
        resolve(payload.message);
      });
    });

    // Simulate backend emitting
    const gateway = app.get<FlowLogsGateway>(FlowLogsGateway);
    gateway.emitLog({
      runId,
      nodeId: 'n1',
      status: 'success',
      timestamp: Date.now(),
      message: 'hello',
    });

    const msg = await promise;
    expect(msg).toBe('hello');
    client.disconnect();
  });
});
