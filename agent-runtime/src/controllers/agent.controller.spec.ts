import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from '../services/agent.service';
import { RunDto } from '../dto/run.dto';

describe('AgentController', () => {
  let controller: AgentController;
  let service: AgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        {
          provide: AgentService,
          useValue: { run: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AgentController>(AgentController);
    service = module.get<AgentService>(AgentService);
  });

  it('should return mapped output for REST', async () => {
    const fakeResponse = { output_text: 'hello' };
    (service.run as jest.Mock).mockResolvedValue(fakeResponse);

    const dto: RunDto = { prompt: 'test-prompt', parameters: {} };
    const result = await controller.run(dto);
    expect(service.run).toHaveBeenCalledWith('test-prompt', {});
    expect(result).toHaveProperty('output');
    expect(result.output[0].content[0].text).toBe('hello');
  });
});
