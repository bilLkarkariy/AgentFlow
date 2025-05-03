/**
 * Shared domain types: Flow
 */
export interface FlowNodeDto {
  id: string;
  type: string;
  positionX: number;
  positionY: number;
  data: unknown;
}

export interface FlowEdgeDto {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface FlowMappingDto {
  output: string;
  input: string;
}

export interface FlowDto {
  nodes: FlowNodeDto[];
  edges: FlowEdgeDto[];
  mappings: FlowMappingDto[];
}
