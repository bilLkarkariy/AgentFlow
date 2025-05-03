import { FlowEngineService } from './flow-engine.service';
import { AgentPythonClientService } from './agent-python-client.service';
import { FlowDto } from '../agents/flow/flow.dto';
import { trace } from '@opentelemetry/api';
import * as crypto from 'crypto';
import { of } from 'rxjs';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('11111111-1111-1111-1111-111111111111'),
}));

describe('FlowEngineService.serialize', () => {
  let service: FlowEngineService;

  beforeAll(() => {
    const mockSpan = { spanContext: () => ({ traceId: 'fixed-trace' }) } as any;
    jest.spyOn(trace, 'getSpan').mockReturnValue(mockSpan);
  });

  beforeEach(() => {
    service = new FlowEngineService({} as any);
  });

  it('serializes full FlowDto correctly', () => {
    const flowDto = {
      nodes: [
        { id: 'n1', type: 'type', positionX: 0, positionY: 0, data: {}, name: 'agent1', instructions: 'instr', model: 'mod', tools: ['t1'] } as any,
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'lbl' } as any],
      mappings: [] as any[],
    } as FlowDto;
    const payload = (service as any).serialize(flowDto, 'input-data');
    expect(payload).toMatchObject({
      runId: '11111111-1111-1111-1111-111111111111',
      traceId: 'fixed-trace',
      input: 'input-data',
      agents: [{ id: 'n1', name: 'agent1', instructions: 'instr', model: 'mod', tools: ['t1'] }],
      edges: [['n1', 'n2']],
    });
    expect(payload.config).toBeUndefined();
  });

  it('sets defaults when optional fields are missing', () => {
    const flowDto = {
      nodes: [{ id: 'n2', type: 'type2', positionX: 1, positionY: 1, data: {} } as any],
      edges: [] as any[],
      mappings: [] as any[],
    } as FlowDto;
    const payload = (service as any).serialize(flowDto, 'other-input');
    expect(payload.agents).toEqual([{ id: 'n2', name: undefined, instructions: '', model: undefined, tools: [] }]);
    expect(payload.edges).toEqual([]);
  });
});

// === runFlow tests ===
describe('FlowEngineService.runFlow', () => {
  let service: FlowEngineService;
  let client: Partial<AgentPythonClientService>;

  beforeEach(() => {
    client = { run: jest.fn().mockReturnValue(of('a', 'b', 'c')) };
    service = new FlowEngineService(client as AgentPythonClientService);
  });

  it('calls client.run with serialized payload and emits tokens', done => {
    const tokens: string[] = [];
    service.runFlow({ nodes: [], edges: [], mappings: [] } as FlowDto, 'input-data')
      .subscribe({
        next: token => tokens.push(token),
        complete: () => {
          expect(client.run).toHaveBeenCalledWith(expect.objectContaining({ input: 'input-data' }));
          expect(tokens).toEqual(['a', 'b', 'c']);
          done();
        },
      });
  });
});
