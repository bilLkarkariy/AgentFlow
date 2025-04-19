import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private readonly repo: Repository<Agent>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  async create(dto: CreateAgentDto) {
    const agent = this.repo.create(dto);
    return this.repo.save(agent);
  }

  findOne(id: string) {
    return this.repo.findOneBy({ id });
  }
}
