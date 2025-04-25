import { Test, TestingModule } from '@nestjs/testing';
import { AgentGrpcController } from './agent.grpc.controller';
import { AgentService } from '../services/agent.service';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';

describe('AgentGrpcController', () => {
  let controller: AgentGrpcController;
  let service: AgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentGrpcController],
      providers: [
        {
          provide: AgentService,
          useValue: { run: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AgentGrpcController>(AgentGrpcController);
    service = module.get<AgentService>(AgentService);
  });

  it('should stream RunResponse chunks with text from service', async () => {
    // Mock service.run to return a response containing output_text
    (service.run as jest.Mock).mockResolvedValue({ output_text: 'grpc-hello' });

    // Create an input observable that emits a single request
    const input$ = of({ prompt: 'grpc-prompt', parameters: {} });
    const output$ = controller.run(input$);

    // Retrieve first emission
    const result = await lastValueFrom(output$);

    expect(service.run).toHaveBeenCalledWith('grpc-prompt', {});
    expect(result).toEqual({ content: [{ text: 'grpc-hello' }] });
  });
});
