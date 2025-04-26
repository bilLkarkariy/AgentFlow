import { useEffect, useMemo, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useFlowStore } from '../store/useFlowStore';
import axios from 'axios';
import NodePalette from '../components/NodePalette';
import NodeBox from '../components/NodeBox';
import NodeInspector from '../components/NodeInspector';
import AgentBlockNode from '../nodes/AgentBlockNode/AgentBlockNode';
import { nanoid } from 'nanoid';

export default function DesignerPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const navigate = useNavigate();

  const { nodes: storeNodes, edges: storeEdges, selectedNodeId, setSelectedNode, updateNodeData, setNodes: setStoreNodes, setEdges: setStoreEdges, addNode: storeAddNode, addEdge: storeAddEdge } = useFlowStore();
  const [nodes, setNodesRf, _onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdgesRf, _onEdgesChange] = useEdgesState(storeEdges);

  // load on mount
  useEffect(() => {
    if (!agentId) return;
    axios.get(`${baseUrl}/agents/${agentId}/flow`).then((res) => {
      const loadedNodes = res.data.nodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        position: { x: n.positionX, y: n.positionY },
        data: n.data,
      }));
      const loadedEdges = res.data.edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
      }));
      // update both React Flow and Zustand store
      setNodesRf(loadedNodes);
      setEdgesRf(loadedEdges);
      setStoreNodes(loadedNodes);
      setStoreEdges(loadedEdges);
    });
  }, [agentId, setStoreNodes, setStoreEdges]);

  const save = () => {
    if (!agentId) return;
    axios.put(`${baseUrl}/agents/${agentId}/flow`, {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        positionX: n.position.x,
        positionY: n.position.y,
        data: n.data,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
    });
  };

  const runFlow = async () => {
    if (!agentId) return;
    const res = await axios.post(`${baseUrl}/agents/${agentId}/flow/execute`);
    const runId = res.data.runId;
    navigate(`/runs/${runId}`);
  };

  // React Flow handlers
  const onNodeClick = (_: any, node: any) => {
    console.log('[DEBUG] onNodeClick', node.id);
    setSelectedNode(node.id);
  };

  const onPaneClick = () => {
    console.log('[DEBUG] onPaneClick');
    setSelectedNode(undefined);
  };

  const onEdgesChange = (changes: any) => setEdgesRf((eds) => applyEdgeChanges(changes, eds));
  
  const willCreateCycle = (source: string, target: string, edgesList: any[]): boolean => {
    // simple DFS from target to see if source is reachable
    const adj: Record<string, string[]> = {};
    edgesList.forEach((e) => {
      adj[e.source] = adj[e.source] ? [...adj[e.source], e.target] : [e.target];
    });
    const stack = [target];
    const visited = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === source) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      (adj[cur] ?? []).forEach((n) => stack.push(n));
    }
    return false;
  };

  const onConnect = (connection: any) => {
    // prevent cycles
    if (willCreateCycle(connection.source, connection.target, edges)) {
      alert('Cycle not allowed');
      return;
    }
    const label = connection.sourceHandle === 'true' ? 'true' : connection.sourceHandle === 'false' ? 'false' : undefined;
    const newEdge = { ...connection, id: nanoid(), label };
    setEdgesRf((eds) => addEdge(newEdge, eds));
    storeAddEdge(newEdge);
  };

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // helper to update node data both in RF local state and zustand store
  const updateNode = (id: string, patch: any) => {
    console.log('[DEBUG] updateNode', id, patch);
    setNodesRf((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    updateNodeData(id, patch);
  };

  useEffect(() => {
    console.log('[DEBUG] selectedNodeId', selectedNodeId);
  }, [selectedNodeId]);

  const addNodeAtCenter = useCallback((type: string) => {
    if (type === 'start' && nodes.some((n) => n.type === 'start')) {
      alert('Flow already has a start node');
      return;
    }
    // calculate center, fallback if ReactFlow instance not yet available
    const position = reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const newNode = { id: nanoid(), type, position, data: { label: type } } as any;
    // add to Zustand store
    storeAddNode(newNode);
    // update React Flow state
    setNodesRf((nds) => [...nds, newNode]);
  }, [reactFlowInstance, storeAddNode, nodes]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;
      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) ?? { x: event.clientX, y: event.clientY };
      setNodesRf((nds) => nds.concat({ id: nanoid(), type, position, data: { label: type } } as any));
    },
    [reactFlowInstance],
  );

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const nodeTypes = useMemo(() => ({
    start: NodeBox,
    emailSend: NodeBox,
    slackPost: NodeBox,
    condition: NodeBox,
    loop: NodeBox,
    agent: AgentBlockNode,
  }), []);

  return (
    <div className="h-screen flex">
      <NodePalette onSelect={addNodeAtCenter} />
      <div className="flex-1 flex flex-col">
        <div className="p-2 bg-gray-100 flex gap-2">
          <button onClick={save} className="bg-blue-600 text-white px-3 py-1 rounded">Save</button>
          <button onClick={runFlow} className="bg-green-600 text-white px-3 py-1 rounded">
            Run
          </button>
        </div>
        <div className="flex-1 flex">
          <div className="flex-1">
            <div className="reactflow-wrapper flex-1 h-full">
              <ReactFlow
                nodeTypes={nodeTypes}
                nodes={nodes}
                edges={edges}
                onNodesChange={_onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                fitView
                onInit={setReactFlowInstance}
                style={{ width: '100%', height: '100%' }}
              >
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>
            </div>
          </div>
          <NodeInspector node={nodes.find((n) => n.id === selectedNodeId)} updateNode={updateNode} />
        </div>
      </div>
    </div>
  );
}
