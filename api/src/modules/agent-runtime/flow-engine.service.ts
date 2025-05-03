import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AgentPythonClientService } from './agent-python-client.service';
import { FlowDto } from '../agents/flow/flow.dto';
import { randomUUID } from 'crypto';
import { context, trace } from '@opentelemetry/api';
import { FlowPayload, FlowPayloadSchema } from '../../common/schemas/flow-payload.zod';

@Injectable()
export class FlowEngineService {
  constructor(private readonly client: AgentPythonClientService) {}

  /**
   * Serialize DSL and run via Python runner
   */
  runFlow(flow: FlowDto, input: string): Observable<string> {
    const payload = this.serialize(flow, input);
    return this.client.run(payload);
  }

  /** Map FlowDto to FlowPayload v1 */
  private serialize(flow: FlowDto, input: string): FlowPayload {
    const currentSpan = trace.getSpan(context.active());
    const traceId = currentSpan?.spanContext().traceId;
    const agents = flow.nodes.map(n => {
      const agentTools = (n as any).tools?.map((blk: any) =>
        typeof blk.toOpenAITool === 'function' ? blk.toOpenAITool() : blk
      ) || [];
      return {
        id: n.id,
        name: (n as any).name,
        instructions: (n as any).instructions || '',
        model: (n as any).model,
        tools: agentTools,
      };
    });
    const edges: [string, string][] = flow.edges.map(e => [e.source, e.target]);
    const payload: FlowPayload = { runId: randomUUID(), traceId, input, agents, edges };
    // Validate and apply defaults
    return FlowPayloadSchema.parse(payload);
  }
}

// Removed inline FlowPayload interface; using Zod schema from common/schemas
