import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

const EXCHANGE = 'gmail.events';

export interface SubscribeOptions {
  /**
   * Name of a durable queue shared by every replica (competing consumers).
   * Omit it to get a per-instance exclusive queue (broadcast).
   */
  queue?: string;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection?: amqp.Connection;
  private channel?: amqp.Channel;
  private connected = false;

  async onModuleInit() {
    const isTest = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
    if (isTest) {
      return;
    }
    const url = process.env.RABBITMQ_URL || 'amqp://localhost';
    this.connection = await amqp.connect(url);
    this.connection.on('error', (err: Error) => {
      this.connected = false;
      this.logger.error(`RabbitMQ connection error: ${err?.message ?? err}`);
    });
    this.connection.on('close', () => {
      this.connected = false;
      this.logger.warn('RabbitMQ connection closed');
    });
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'fanout', { durable: false });
    this.connected = true;
  }

  /** Used by the readiness probe. */
  isConnected(): boolean {
    return this.connected;
  }

  async publish(event: string, payload: Record<string, unknown>) {
    if (!this.channel) return;
    const msg = Buffer.from(JSON.stringify({ event, payload, timestamp: Date.now() }));
    this.channel.publish(EXCHANGE, '', msg);
  }

  async subscribe(
    event: string,
    handler: (payload: any) => void | Promise<void>,
    opts: SubscribeOptions = {},
  ) {
    if (!this.channel) return;

    if (opts.queue) {
      // Durable named queue: every replica consumes from the same queue, so a
      // message is handled once by the cluster instead of once per replica.
      const channel = this.channel;
      await channel.assertQueue(opts.queue, { durable: true });
      await channel.bindQueue(opts.queue, EXCHANGE, '');
      await channel.prefetch(1);
      await channel.consume(
        opts.queue,
        async (msg: amqp.ConsumeMessage | null) => {
          if (!msg) return;
          let content: { event?: string; payload?: any };
          try {
            content = JSON.parse(msg.content.toString());
          } catch (err) {
            this.logger.error(`Dropping unparsable message on ${opts.queue}`);
            channel.nack(msg, false, false);
            return;
          }
          // The exchange is a fanout: acknowledge and drop the events we don't handle.
          if (content.event !== event) {
            channel.ack(msg);
            return;
          }
          try {
            await handler(content.payload);
            channel.ack(msg);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Handler for ${event} failed, dropping message: ${message}`);
            channel.nack(msg, false, false);
          }
        },
        { noAck: false },
      );
      return;
    }

    // Broadcast: a temporary exclusive queue bound to the exchange, one per instance.
    const q = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(q.queue, EXCHANGE, '');
    this.channel.consume(
      q.queue,
      (msg: amqp.ConsumeMessage | null) => {
        if (!msg) return;
        const content = JSON.parse(msg.content.toString());
        if (content.event === event) {
          handler(content.payload);
        }
      },
      { noAck: true },
    );
  }

  async onModuleDestroy() {
    this.connected = false;
    await this.channel?.close();
    await this.connection?.close();
  }
}
