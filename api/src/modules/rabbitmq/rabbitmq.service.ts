import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;

  async onModuleInit() {
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

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
