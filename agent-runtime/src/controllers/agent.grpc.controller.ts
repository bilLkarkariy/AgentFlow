import { Controller } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap, map } from 'rxjs/operators';
import { AgentService } from '../services/agent.service';
import { mapDslToTools } from '../utils/dsl-tool-mapper';

@Controller()
export class AgentGrpcController {
  constructor(private readonly agent: AgentService) {}

  run(request$: Observable<any>): Observable<any> {
    return request$.pipe(
      mergeMap((req) => {
        const dslStr: string = typeof req.dsl === 'string' ? req.dsl : req.prompt;
        const params = req.parameters || {};
        if (req.dsl === undefined) {
          return from(this.agent.run(dslStr, params)).pipe(
            map((response: any) => {
              const raw = response.output_text ?? '';
              const text = typeof raw === 'object' ? JSON.stringify(raw) : raw;
              return { content: [{ text }] };
            }),
          );
        }
        let tools;
        try { tools = mapDslToTools(JSON.parse(dslStr)); } catch { tools = []; }
        return from(this.agent.run(dslStr, params, tools)).pipe(
          map((response: any) => {
            const raw = response.output_text ?? '';
            const text = typeof raw === 'object' ? JSON.stringify(raw) : raw;
            return { content: [{ text }] };
          }),
        );
      }),
    );
  }
}
