import { Node } from 'reactflow';

interface Props {
  node?: Node;
  updateNode: (id: string, patch: any) => void;
}

export default function NodeInspector({ node, updateNode }: Props) {
  if (!node)
    return (
      <div className="w-64 border-l p-3 text-sm bg-white">Select a node</div>
    );

  const set = (patch: any) => updateNode(node.id, patch);

  return (
    <div className="w-64 border-l p-3 space-y-3 text-sm bg-white overflow-y-auto">
      <h2 className="font-semibold text-base mb-2">{node.type} properties</h2>

      {/* Label */}
      <div className="flex flex-col gap-1">
        <label className="text-xs">Label</label>
        <input
          className="border px-1 py-0.5 rounded"
          value={node.data?.label ?? ''}
          onChange={(e) => set({ label: e.target.value })}
        />
      </div>

      {node.type === 'emailSend' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs">To</label>
            <input
              className="border px-1 py-0.5 rounded"
              value={node.data?.to ?? ''}
              onChange={(e) => set({ to: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Subject</label>
            <input
              className="border px-1 py-0.5 rounded"
              value={node.data?.subject ?? ''}
              onChange={(e) => set({ subject: e.target.value })}
            />
          </div>
        </>
      )}

      {node.type === 'slackPost' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Channel</label>
            <input
              className="border px-1 py-0.5 rounded"
              value={node.data?.channel ?? ''}
              onChange={(e) => set({ channel: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs">Message</label>
            <textarea
              className="border px-1 py-0.5 rounded"
              value={node.data?.message ?? ''}
              onChange={(e) => set({ message: e.target.value })}
            />
          </div>
        </>
      )}

      {node.type === 'condition' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs">Expression</label>
          <input
            className="border px-1 py-0.5 rounded font-mono"
            placeholder="e.g., amount > 1000"
            value={node.data?.expression ?? ''}
            onChange={(e) => set({ expression: e.target.value })}
          />
        </div>
      )}

      {node.type === 'loop' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs">Collection name</label>
          <input
            className="border px-1 py-0.5 rounded"
            placeholder="items"
            value={node.data?.collection ?? ''}
            onChange={(e) => set({ collection: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
