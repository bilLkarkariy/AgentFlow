import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

interface AgentGrpcClient {
  run(request?: any): any;
}

@Injectable()
export class AgentRuntimeService {
  private client: AgentGrpcClient;
  private readonly logger = new Logger(AgentRuntimeService.name);

  constructor(@Inject('AGENT_RUNTIME') private readonly grpcClient: ClientGrpc) {
    this.client = this.grpcClient.getService<AgentGrpcClient>('AgentService');
  }

  async run(prompt: string, parameters: Record<string, any>): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const call = this.client.run({});
      const chunks: string[] = [];
      call.on('data', (resp: any) => {
        if (resp.content && Array.isArray(resp.content)) {
          resp.content.forEach((c: any) => chunks.push(c.text));
        } else if (resp.token) {
          chunks.push(resp.token);
        }
      });
      call.on('end', () => resolve(chunks));
      call.on('error', (err: any) => {
        this.logger.error('gRPC error', err);
        reject(err);
      });
      call.write({ prompt, parameters });
      call.end();
    });
  }
}
