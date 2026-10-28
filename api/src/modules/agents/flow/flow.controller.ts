import { Body, Controller, Get, Param, Put, Post, Header, Sse, MessageEvent, Query, HttpCode, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiTags, ApiProduces } from '@nestjs/swagger';
import { FlowService } from './flow.service';
import { from, Observable, of, EMPTY } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { FlowEngineService } from '../../agent-runtime/flow-engine.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiQuery as SwaggerQuery } from '@nestjs/swagger';
import { DslParserService } from '../../agent-runtime/dsl-parser.service';
import { PricingService } from '../../pricing/pricing.service';

/** Display-only conversion for the historical `euros` stat key. */
const USD_TO_EUR = 0.92;

@ApiTags('flows')
@Controller('agents/:id/flow')
export class FlowController {
  constructor(
    private readonly service: FlowService,
    private readonly flowEngineService: FlowEngineService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dslParserService: DslParserService,
    private readonly pricing: PricingService,
  ) {}

  @Get()
  get(@Param('id') agentId: string) {
    return this.service.getDto(agentId);
  }

  @Put()
  save(@Param('id') agentId: string, @Body() body: any) {
    const dto = typeof body === 'string'
      ? this.dslParserService.parse(body)
      : body;
    return this.service.save(agentId, dto);
  }

  @Post('run')
  async runFromDsl(
    @Param('id') agentId: string,
    @Body() body: any,
    @Query('input') inputQuery: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.status(200);
    res.flushHeaders();
    const dto = typeof body === 'string'
      ? this.dslParserService.parse(body)
      : body;
    const model = this.pricing.normalizeModel(dto?.nodes?.[0]?.model);
    let tokenCount = 0;
    this.flowEngineService.runFlow(dto, inputQuery).subscribe({
      next: token => {
        tokenCount++;
        res.write(`data: ${token}\n\n`);
      },
      error: () => res.end(),
      complete: () => {
        const usd = this.pricing.costFor(model, tokenCount);
        res.write(`event: stats\n`);
        res.write(
          `data: ${JSON.stringify({
            tokens: tokenCount,
            model,
            usd,
            // kept for the studio UI, which still reads `euros`
            euros: usd * USD_TO_EUR,
          })}\n\n`,
        );
        res.end();
      },
    });
  }

  @ApiOperation({ summary: 'Execute a flow and stream tokens' })
  @SwaggerQuery({ name: 'format', required: false, schema: { enum: ['sse', 'ws'], default: 'sse' } })
  @SwaggerQuery({ name: 'input', required: true, description: 'Input string for the flow' })
  @ApiProduces('text/event-stream')
  @Sse('execute')
  executeFlow(
    @Param('id') agentId: string,
    @Query('format') fmt = 'sse',
    @Query('input') inputQuery: string,
  ): Observable<MessageEvent> {
    const input = inputQuery;
    return from(this.service.getDto(agentId)).pipe(
      mergeMap(flowDto => this.flowEngineService.runFlow(flowDto, input)),
      mergeMap(token => {
        if (fmt === 'sse') {
          return of({ data: token });
        } else {
          this.eventEmitter.emit('tokens', { runId: agentId, token });
          return EMPTY;
        }
      }),
    );
  }
}
