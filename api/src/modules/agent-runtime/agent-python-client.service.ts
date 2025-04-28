import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';

interface RunRequest { prompt: string; parameters: Record<string, any>; }
interface RunResponse { token: string; }

@Injectable()
export class AgentPythonClientService implements OnModuleInit {
  private client: { run(request: RunRequest): Observable<RunResponse> };

  constructor(
    @Inject('AG_PY') private readonly grpcClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.client = this.grpcClient.getService<{ run(request: RunRequest): Observable<RunResponse> }>(
      'AgentService',
    );
  }

  runAgent(request: RunRequest): Observable<RunResponse> {
    return this.client.run(request);
  }
}
