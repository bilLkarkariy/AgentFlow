import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'node:path';

const PROTO_PATH = path.resolve(__dirname, '../../../../proto/agent.proto');

interface RunRequest {
  prompt: string;
  parameters?: Record<string, string>;
}

/**
 * AgentRuntimeClient
 * -------------------
 * Nouveau nom (ex-CrewRuntimeClient) pour appeler le micro-service **agent-runtime**
 * via gRPC streaming. L’adresse peut être configurée via l’ENV `AGENT_RUNTIME_GRPC_HOST`.
 */
export class AgentRuntimeClient {
  private client: any;

  constructor(private host = process.env.AGENT_RUNTIME_GRPC_HOST ?? 'localhost:50051') {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    this.client = new proto.agent.AgentService(
      host,
      grpc.credentials.createInsecure(),
    );
  }

  run(request: RunRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      const call = this.client.Run();
      let output = '';
      call.on('data', (res: { token: string }) => {
        output += `${res.token} `;
      });
      call.on('error', reject);
      call.on('end', () => resolve(output.trim()));
      // first message only
      call.write({ prompt: request.prompt, parameters: request.parameters ?? {} });
      call.end();
    });
  }
}
