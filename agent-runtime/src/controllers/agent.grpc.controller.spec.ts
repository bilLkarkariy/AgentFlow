import { AgentGrpcController } from './agent.grpc.controller';
import { AgentService } from '../services/agent.service';
import { of, lastValueFrom } from 'rxjs';

describe('AgentGrpcController', () => {
  let controller: AgentGrpcController;
  let service: AgentService;

  beforeEach(() => {
    // Mock AgentService and instantiate controller directly
    service = { run: jest.fn().mockReturnValue(of({ output_text: 'grpc-hello' })) } as any;
    controller = new AgentGrpcController(service);
  });

  it('should stream RunResponse chunks with text from service', async () => {
    const input$ = of({ prompt: 'grpc-prompt', parameters: {} });
    const output$ = controller.run(input$);
    const result = await lastValueFrom(output$);

    expect(service.run).toHaveBeenCalledWith('grpc-prompt', {});
    expect(result).toEqual({ content: [{ text: 'grpc-hello' }] });
  });
});