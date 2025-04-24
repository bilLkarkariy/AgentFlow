import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;

  async onModuleInit() {
    const isTest = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
    if (isTest) {
      return;
    }
    const url = process.env.RABBITMQ_URL || 'amqp://localhost';
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange('gmail.events', 'fanout', { durable: false });
  }

  async publish(event: string, payload: Record<string, unknown>) {
    if (!this.channel) return;
    const msg = Buffer.from(JSON.stringify({ event, payload, timestamp: Date.now() }));
    this.channel.publish('gmail.events', '', msg);
  }

  async subscribe(event: string, handler: (payload: any) => void) {
    if (!this.channel) return;
    // Create a temporary exclusive queue bound to the exchange
    const q = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(q.queue, 'gmail.events', '');
    // Consume messages
    this.channel.consume(
      q.queue,
      msg => {
        if (!msg) return;
        const content = JSON.parse(msg.content.toString());
        if (content.event === event) {
          handler(content.payload);
        }
      },
      { noAck: true }
    );
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
