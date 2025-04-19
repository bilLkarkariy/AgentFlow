import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { DslParserService } from './dsl-parser.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly service: AgentsService,
    private readonly parser: DslParserService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAgentDto) {
    return this.service.create(dto);
  }

  @Post('/from-prompt')
  createFromPrompt(@Body('prompt') prompt: string) {
    const dsl = this.parser.parsePrompt(prompt);
    return this.service.create({ name: dsl.name, dsl });
  }
}
