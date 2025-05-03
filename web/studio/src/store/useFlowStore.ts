import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Edge, Node } from 'reactflow';

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  mappings: { output: string; input: string }[];
  setNodes: (n: Node[]) => void;
  setEdges: (e: Edge[]) => void;
  addNode: (node: Node) => void;
  addEdge: (edge: Edge) => void;
  addMapping: (m: { output: string; input: string }) => void;
  removeMapping: (m: { output: string; input: string }) => void;
  setMappings: (m: { output: string; input: string }[]) => void;
  selectedNodeId?: string;
  setSelectedNode: (id?: string) => void;
  updateNodeData: (id: string, data: any) => void;
  reset: () => void;
}

export const useFlowStore = create<FlowState>()(
  devtools((set) => ({
    nodes: [],
    edges: [],
    mappings: [],
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    addNode: (node) =>
      set((state) => ({
        nodes: [...state.nodes, node],
      })),
    addEdge: (edge) =>
      set((state) => ({
        edges: [...state.edges, edge],
        mappings: [...state.mappings],
      })),
    addMapping: (m) => set((state) => ({ mappings: [...state.mappings, m] })),
    removeMapping: (m) => set((state) => ({ mappings: state.mappings.filter(x => x !== m) })),
    setMappings: (mappings) => set({ mappings }),
    selectedNodeId: undefined,
    setSelectedNode: (id) => set({ selectedNodeId: id }),
    updateNodeData: (id, data) =>
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
      })),
    reset: () => set({ nodes: [], edges: [], selectedNodeId: undefined }),
  })),
);
