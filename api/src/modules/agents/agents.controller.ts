import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CreateFromPromptDto } from './dto/create-from-prompt.dto';
import { DslParserService } from './dsl-parser.service';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';

@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly service: AgentsService,
    private readonly parser: DslParserService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all agents' })
  @ApiResponse({ status: 200, description: 'List of agents' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an agent by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Agent found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiBody({ type: CreateAgentDto })
  @ApiResponse({ status: 201, description: 'Agent created' })
  create(@Body() dto: CreateAgentDto) {
    return this.service.create(dto);
  }

  @Post('/from-prompt')
  @ApiOperation({ summary: 'Generate an agent from a prompt' })
  @ApiBody({ type: CreateFromPromptDto })
  @ApiResponse({ status: 201, description: 'Agent generated and created' })
  async createFromPrompt(@Body() dto: CreateFromPromptDto) {
    const dsl = this.parser.parsePrompt(dto.prompt);
    return this.service.create({ name: dsl.name, dsl });
  }
}
