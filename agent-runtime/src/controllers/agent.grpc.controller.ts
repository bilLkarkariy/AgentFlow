import { Controller } from '@nestjs/common';
import { GrpcStreamMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { AgentService } from '../services/agent.service';

@Controller()
export class AgentGrpcController {
  constructor(private readonly agent: AgentService) {}

  @GrpcStreamMethod('Agent', 'Run')
  run(request$: Observable<any>): Observable<any> {
    return request$.pipe(
      mergeMap(async (req) => {
        // Call the existing service to get the full response
        const response: any = await this.agent.run(req.prompt, req.parameters);
        const text = response.output_text ?? '';
        // Stream a single RunResponse chunk
        return { content: [{ text: typeof text === 'object' ? JSON.stringify(text) : text }] };
      }),
    );
  }
}
