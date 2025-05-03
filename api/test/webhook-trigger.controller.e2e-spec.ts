import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as crypto from 'crypto';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookTriggerModule } from '../src/modules/webhook-trigger/webhook-trigger.module';
import { WebhookTrigger } from '../src/modules/webhook-trigger/webhook-trigger.entity';
import { RabbitMQService } from '../src/modules/rabbitmq/rabbitmq.service';

class MockRabbit {
  publish = jest.fn();
}

describe('WebhookTriggerController (e2e)', () => {
  let app: INestApplication;
  let secret: string;
  let id: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:', autoLoadEntities: true, synchronize: true }),
        TypeOrmModule.forFeature([WebhookTrigger]),
        WebhookTriggerModule,
      ],
    })
      .overrideProvider(RabbitMQService)
      .useValue(new MockRabbit())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // create trigger
    const repo = moduleRef.get('WebhookTriggerRepository');
    const trig = await repo.save({ secret: crypto.randomBytes(32).toString('hex') });
    id = trig.id;
    secret = trig.secret;
  });

  afterAll(async () => await app.close());

  it('returns 401 on bad signature', () =>
    request(app.getHttpServer())
      .post(`/triggers/webhook/${id}`)
      .send({ foo: 'bar' })
      .set('x-signature', 'invalid')
      .expect(200)
      .expect({ status: 'unauthorized' }));

  it('returns 200 and publishes on valid signature', () => {
    const payload = { foo: 'bar' };
    const sig = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

    return request(app.getHttpServer())
      .post(`/triggers/webhook/${id}`)
      .send(payload)
      .set('x-signature', sig)
      .expect(200)
      .expect({ status: 'ok' })
      .then(() => {
        const mock = app.get<RabbitMQService>(RabbitMQService);
        expect((mock as any).publish).toHaveBeenCalledWith('webhook.received', payload);
      });
  });
});
