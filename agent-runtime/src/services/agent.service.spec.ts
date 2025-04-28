import { AgentService } from './agent.service';
import { ClientGrpc } from '@nestjs/microservices';
import { of } from 'rxjs';

describe('AgentService', () => {
  let service: AgentService;
  let mockStub: { Run: jest.Mock };

  beforeEach(() => {
    mockStub = { Run: jest.fn().mockReturnValue(of({ token: JSON.stringify({ result: 42 }) })) };
    const mockClient = { getService: () => mockStub } as Partial<ClientGrpc>;
    service = new AgentService(mockClient as ClientGrpc);
    service.onModuleInit();
  });

  it('should call AgentService.Run and parse JSON response', async () => {
    const result = await service.run('prompt', {});
    expect(mockStub.Run).toHaveBeenCalledWith({ prompt: 'prompt', parameters: {}, toolsJson: JSON.stringify([]) });
    expect(result).toEqual({ result: 42 });
  });
});
