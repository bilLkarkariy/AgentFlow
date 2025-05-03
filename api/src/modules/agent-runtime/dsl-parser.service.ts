import { Injectable, BadRequestException } from '@nestjs/common';
import * as yaml from 'js-yaml';
import { FlowDto, NodeDto, EdgeDto, MappingDto } from '../agents/flow/flow.dto';

@Injectable()
export class DslParserService {
  parse(yamlString: string): FlowDto {
    let doc: any;
    try {
      doc = yaml.load(yamlString);
    } catch (error) {
      throw new BadRequestException('Invalid DSL YAML');
    }
    if (!doc || typeof doc !== 'object') {
      throw new BadRequestException('Invalid DSL content');
    }
    const { nodes, edges, mappings } = doc as any;
    if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(mappings)) {
      throw new BadRequestException('DSL missing required arrays: nodes, edges, mappings');
    }
    const flowDto: FlowDto = {
      nodes: nodes.map((n: any) => {
        const node = new NodeDto();
        node.id = n.id;
        node.type = n.type;
        node.positionX = n.position?.x ?? 0;
        node.positionY = n.position?.y ?? 0;
        node.data = n.data ?? {};
        return node;
      }),
      edges: edges.map((e: any) => {
        const edge = new EdgeDto();
        edge.id = e.id ?? `${e.source}-${e.target}`;
        edge.source = e.source;
        edge.target = e.target;
        edge.label = e.label;
        return edge;
      }),
      mappings: mappings.map((m: any) => {
        const mapping = new MappingDto();
        mapping.input = m.input;
        mapping.output = m.output;
        return mapping;
      }),
    };
    return flowDto;
  }
}
