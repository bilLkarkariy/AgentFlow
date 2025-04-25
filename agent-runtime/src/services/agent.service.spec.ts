import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AgentService } from './agent.service';

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: ConfigService, useValue: { get: jest.fn(() => 'fake_key') } },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
  });

  it('should call Responses API and return response', async () => {
    const mockRes = { output_text: 'test-text', output: [] };
    // Mock openai.responses.create
    (service as any).openai.responses = { create: jest.fn().mockResolvedValue(mockRes) };

    const res = await service.run('prompt', {});
    expect((service as any).openai.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.any(Array) }),
    );
    expect(res).toBe(mockRes);
  });
});
