import { of } from 'rxjs';
import { FlowController } from './flow.controller';
import { FlowService } from './flow.service';
import { DslParserService } from '../../agent-runtime/dsl-parser.service';
import { FlowEngineService } from '../../agent-runtime/flow-engine.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FlowDto } from './flow.dto';
import { MessageEvent } from '@nestjs/common';

describe('FlowController', () => {
  let controller: FlowController;
  let parsedDto: FlowDto;
  let flowService: Partial<FlowService>;
  let dslParserService: Partial<DslParserService>;
  let flowEngineService: Partial<FlowEngineService>;
  let eventEmitter: Partial<EventEmitter2>;

  beforeEach(() => {
    parsedDto = { nodes: [], edges: [], mappings: [] };
    flowService = { save: jest.fn(), getDto: jest.fn().mockResolvedValue(parsedDto) };
    dslParserService = { parse: jest.fn().mockReturnValue(parsedDto) };
    flowEngineService = { runFlow: jest.fn().mockReturnValue(of('chunk1', 'chunk2')) };
    eventEmitter = { emit: jest.fn() };
    controller = new FlowController(
      flowService as FlowService,
      flowEngineService as FlowEngineService,
      eventEmitter as EventEmitter2,
      dslParserService as DslParserService,
    );
  });

  describe('save', () => {
    it('parses DSL string and calls save', () => {
      const yaml = 'nodes: [] edges: [] mappings: []';
      controller.save('agent1', yaml);
      expect(dslParserService.parse).toHaveBeenCalledWith(yaml);
      expect(flowService.save).toHaveBeenCalledWith('agent1', parsedDto);
    });

    it('calls save directly for DTO object', () => {
      const dto: FlowDto = { nodes: [], edges: [], mappings: [] };
      controller.save('agent1', dto);
      expect(dslParserService.parse).not.toHaveBeenCalled();
      expect(flowService.save).toHaveBeenCalledWith('agent1', dto);
    });
  });

  describe('runFromDsl', () => {
    it('parses DSL and streams tokens', async () => {
      const yaml = 'nodes: [] edges: [] mappings: []';
      const fakeRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };
      await controller.runFromDsl('agent1', yaml, 'input', fakeRes as any);
      expect(dslParserService.parse).toHaveBeenCalledWith(yaml);
      expect(flowEngineService.runFlow).toHaveBeenCalledWith(parsedDto, 'input');
      expect(fakeRes.write).toHaveBeenCalledWith(`data: chunk1\n\n`);
      expect(fakeRes.write).toHaveBeenCalledWith(`data: chunk2\n\n`);
      expect(fakeRes.end).toHaveBeenCalled();
    });
  });
});
