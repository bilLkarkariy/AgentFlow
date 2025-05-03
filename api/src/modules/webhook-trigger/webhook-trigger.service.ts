import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookTrigger } from './webhook-trigger.entity';
import { randomBytes } from 'crypto';

@Injectable()
export class WebhookTriggerService {
  constructor(
    @InjectRepository(WebhookTrigger)
    private readonly repo: Repository<WebhookTrigger>,
  ) {}

  async create(): Promise<WebhookTrigger> {
    const secret = randomBytes(32).toString('hex');
    const trigger = this.repo.create({ secret });
    return this.repo.save(trigger);
  }

  async findOne(id: string): Promise<WebhookTrigger> {
    const trigger = await this.repo.findOneBy({ id });
    if (!trigger) {
      throw new NotFoundException(`WebhookTrigger ${id} not found`);
    }
    return trigger;
  }

  async findAll(): Promise<WebhookTrigger[]> {
    return this.repo.find();
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`WebhookTrigger ${id} not found`);
    }
  }
}
