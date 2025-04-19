import { Test, TestingModule } from '@nestjs/testing';
import { DslParserService, AgentDsl } from '../src/modules/agents/dsl-parser.service';

describe('DslParserService', () => {
  let service: DslParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DslParserService],
    }).compile();

    service = module.get(DslParserService);
  });

  it('should parse a valid French prompt', () => {
    const prompt = 'Quand je reçois un email de alice@example.com, lis le sujet';
    const dsl = service.parsePrompt(prompt);
    expect(dsl).toEqual<AgentDsl>(
      expect.objectContaining({
        trigger: expect.objectContaining({ filter: { from: 'alice@example.com' } }),
        action: expect.objectContaining({ type: 'gmail.read_subject' }),
      }),
    );
  });

  it('should throw if prompt not recognised', () => {
    expect(() => service.parsePrompt('prompt invalide')).toThrow();
  });
});
