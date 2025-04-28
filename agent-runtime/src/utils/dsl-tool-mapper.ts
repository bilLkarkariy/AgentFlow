import {
  SummarizeBlock,
  TranslateBlock,
  EmailClassifierBlock,
  InvoiceExtractorBlock,
} from '@agentflow/agent-library';
import type { OpenAIToolDefinition } from '@agentflow/agent-library';

interface FlowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface FlowDsl {
  nodes: FlowNode[];
  edges: unknown[];
}

const typeMap: Record<string, () => OpenAIToolDefinition> = {
  SummarizeBlock: () => SummarizeBlock.asTool(),
  TranslateBlock: () => TranslateBlock.asTool(),
  EmailClassifierBlock: () => EmailClassifierBlock.asTool(),
  InvoiceExtractorBlock: () => InvoiceExtractorBlock.asTool(),
};

export function mapDslToTools(dsl: FlowDsl): OpenAIToolDefinition[] {
  if (!dsl?.nodes?.length) return [];
  const tools: OpenAIToolDefinition[] = [];
  for (const n of dsl.nodes) {
    const fn = typeMap[n.type];
    if (fn) {
      tools.push(fn());
    }
  }
  return tools;
}
