import { DslParserService } from './dsl-parser.service';
import { BadRequestException } from '@nestjs/common';

describe('DslParserService', () => {
  let service: DslParserService;

  beforeAll(() => {
    service = new DslParserService();
  });

  it('parses valid YAML into FlowDto', () => {
    const yamlString = `
nodes:
  - id: n1
    type: t1
    position:
      x: 1
      y: 2
    data:
      foo: bar
edges:
  - source: n1
    target: n2
mappings:
  - input: i1
    output: o1
`;
    const dto = service.parse(yamlString);
    expect(dto.nodes).toHaveLength(1);
    expect(dto.nodes[0]).toMatchObject({ id: 'n1', type: 't1', positionX: 1, positionY: 2, data: { foo: 'bar' } });
    expect(dto.edges).toHaveLength(1);
    expect(dto.edges[0]).toMatchObject({ source: 'n1', target: 'n2' });
    expect(dto.mappings).toHaveLength(1);
    expect(dto.mappings[0]).toMatchObject({ input: 'i1', output: 'o1' });
  });

  it('throws BadRequestException on invalid YAML', () => {
    const invalid = '::::';
    expect(() => service.parse(invalid)).toThrow(BadRequestException);
  });

  it('throws BadRequestException if missing required arrays', () => {
    const missing = `
nodes: []
edges: []
`;
    expect(() => service.parse(missing)).toThrow(BadRequestException);
  });
});
