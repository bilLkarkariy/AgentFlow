import { Node, Edge } from 'reactflow';
import { nanoid } from 'nanoid';

// Example flow demonstrating Agent Block usage
const inputNodeId = nanoid();
const agentNodeId = nanoid();

export const nodes: Node[] = [
  // Input Text node (assumes type 'inputText' exists)
  {
    id: inputNodeId,
    type: 'inputText',
    position: { x: 50, y: 50 },
    data: { label: 'Enter prompt', text: 'Hello world' },
  },
  // Agent Block node
  {
    id: agentNodeId,
    type: 'agent',
    position: { x: 300, y: 50 },
    data: { prompt: 'Hello world' },
  },
];

export const edges: Edge[] = [
  {
    id: nanoid(),
    source: inputNodeId,
    target: agentNodeId,
    label: 'prompt',
  },
];

export const exampleFlow = { nodes, edges };
