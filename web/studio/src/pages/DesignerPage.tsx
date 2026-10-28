import { useEffect, useMemo, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  addEdge,
  applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useFlowStore } from '../store/useFlowStore';
import { useAgentFlow, useSaveAgentFlow, useRunAgentFlow } from '../entities/agent/api';
import NodePalette from '../components/NodePalette';
import NodeBox from '../components/NodeBox';
import NodeInspector from '../components/NodeInspector';
import AgentBlockNode from '../nodes/AgentBlockNode/AgentBlockNode';
import { nanoid } from 'nanoid';
import TestBar from '../components/TestBar';
import { AgentConfigPanel } from '../components/AgentConfigPanel';
import { io, Socket } from 'socket.io-client';
import RunsList from '../components/RunsList';
import LogsTimeline from '../components/LogsTimeline';
import { API_BASE_URL } from '../shared/lib/env';

export default function DesignerPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  // Run state
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [controlSocket, setControlSocket] = useState<Socket | null>(null);
  const [logSocket, setLogSocket] = useState<Socket | null>(null);

  const { nodes: storeNodes, edges: storeEdges, selectedNodeId, setSelectedNode, updateNodeData, setNodes: setStoreNodes, setEdges: setStoreEdges, addNode: storeAddNode, addEdge: storeAddEdge } = useFlowStore();
  const mappings = useFlowStore((s) => s.mappings);
  const setMappings = useFlowStore((s) => s.setMappings);
  const [nodes, setNodesRf, _onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdgesRf] = useEdgesState(storeEdges);
  const { data: flowData } = useAgentFlow(agentId!);
  const saveMutation = useSaveAgentFlow(agentId!);
  const runMutation = useRunAgentFlow();

  useEffect(() => {
    if (!flowData) return;
    const loadedNodes = flowData.nodes.map((n) => ({ id: n.id, type: n.type, position: { x: n.positionX, y: n.positionY }, data: n.data }));
    const loadedEdges = flowData.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label }));
    setNodesRf(loadedNodes);
    setEdgesRf(loadedEdges);
    setStoreNodes(loadedNodes);
    setStoreEdges(loadedEdges);
    setMappings(flowData.mappings ?? []);
  }, [flowData, setStoreNodes, setStoreEdges]);

  const save = () => {
    if (!agentId) return;
    saveMutation.mutate({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type!,
        positionX: n.position.x,
        positionY: n.position.y,
        data: n.data,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: typeof e.label === 'string' ? e.label : undefined,
      })),
      mappings: mappings,
    });
  };

  const runFlow = async () => {
    if (!agentId) return;
    // start run and get runId
    const res = await runMutation.mutateAsync(agentId!);
    setRunId(res.runId);
  };

  // Setup control socket
  useEffect(() => {
    if (!runId) return;
    const sock = io(API_BASE_URL, { path: '/ws' });
    setControlSocket(sock);
    return () => { sock.disconnect(); };
  }, [runId]);

  // Setup log socket
  useEffect(() => {
    if (!runId) return;
    const sock = io(`${API_BASE_URL}/ws/flow`);
    sock.on('connect', () => sock.emit('join', { runId }));
    sock.on('tokens', () => setProgress(p => p + 1));
    setLogSocket(sock);
    return () => { sock.disconnect(); };
  }, [runId]);

  const stepFlow = () => {
    console.log('[DEBUG] stepFlow');
  };

  const stopFlow = () => {
    if (controlSocket && runId) {
      controlSocket.emit('control', { op: 'cancel', runId });
    }
  };

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
    const position = reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const newNode = { id: nanoid(), type, position, data: { label: type } } as any;
    storeAddNode(newNode);
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
    integration: NodeBox,
  }), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50">
      <NodePalette onSelect={addNodeAtCenter} />
      <div className="flex-1 flex flex-col min-w-0">
        <TestBar onSave={save} onRun={runFlow} onStep={stepFlow} onStop={stopFlow} progress={progress} />
        <div className="flex-1 flex min-h-0">
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
                fitViewOptions={{ padding: 0.22 }}
                onInit={setReactFlowInstance}
                proOptions={{ hideAttribution: true }}
                defaultEdgeOptions={{
                  type: 'smoothstep',
                  style: { stroke: '#c6ccd6', strokeWidth: 1.5 },
                  labelStyle: { fill: '#5b6472', fontSize: 11, fontWeight: 500 },
                  labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95 },
                  labelBgPadding: [6, 3] as [number, number],
                  labelBgBorderRadius: 4,
                }}
                style={{ width: '100%', height: '100%' }}
              >
                <MiniMap
                  className="!bg-white !border !border-line !rounded-lg !shadow-sm"
                  maskColor="rgba(244,245,247,.8)"
                  nodeColor={(n) => (n.data?.tool ? '#9a5b1f' : n.type === 'agent' ? '#2b4c8c' : '#c6ccd6')}
                  nodeStrokeWidth={0}
                  pannable
                  zoomable
                />
                <Controls className="!shadow-sm !border !border-line !rounded-lg overflow-hidden" showInteractive={false} />
                <Background gap={20} size={1} color="#d7dce4" />
              </ReactFlow>
            </div>
          </div>
          <div className="side-panel w-[280px] shrink-0 p-4 border-l border-line bg-white flex flex-col overflow-auto gap-5">
            <NodeInspector node={nodes.find((n) => n.id === selectedNodeId)} updateNode={updateNode} />
            <AgentConfigPanel />
            {agentId && <RunsList agentId={agentId} />}
            {runId && <LogsTimeline runId={runId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
