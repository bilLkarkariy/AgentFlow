import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Edge, Node } from 'reactflow';

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  setNodes: (n: Node[]) => void;
  setEdges: (e: Edge[]) => void;
  addNode: (node: Node) => void;
  addEdge: (edge: Edge) => void;
  selectedNodeId?: string;
  setSelectedNode: (id?: string) => void;
  updateNodeData: (id: string, data: any) => void;
  reset: () => void;
}

export const useFlowStore = create<FlowState>()(
  devtools((set) => ({
    nodes: [],
    edges: [],
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    addNode: (node) =>
      set((state) => ({
        nodes: [...state.nodes, node],
      })),
    addEdge: (edge) =>
      set((state) => ({
        edges: [...state.edges, edge],
      })),
    selectedNodeId: undefined,
    setSelectedNode: (id) => set({ selectedNodeId: id }),
    updateNodeData: (id, data) =>
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
      })),
    reset: () => set({ nodes: [], edges: [], selectedNodeId: undefined }),
  })),
);
