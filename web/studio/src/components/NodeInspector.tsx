import { Node } from 'reactflow';
import { useCallback } from 'react';

interface Props {
  node?: Node;
  updateNode: (id: string, patch: any) => void;
}

// JSON schema mapping for node data forms
const nodeSchemas: Record<string, { properties: Record<string, { type: string; title: string }> }> = {
  start: { properties: { label: { type: 'string', title: 'Label' } } },
  emailSend: { properties: { label: { type: 'string', title: 'Label' }, to: { type: 'string', title: 'To' }, subject: { type: 'string', title: 'Subject' } } },
  slackPost: { properties: { label: { type: 'string', title: 'Label' }, channel: { type: 'string', title: 'Channel' }, message: { type: 'string', title: 'Message' } } },
  condition: { properties: { label: { type: 'string', title: 'Label' }, expression: { type: 'string', title: 'Expression' } } },
  loop: { properties: { label: { type: 'string', title: 'Label' }, collection: { type: 'string', title: 'Collection name' } } },
  agent: { properties: { label: { type: 'string', title: 'Label' } } },
};

export default function NodeInspector({ node, updateNode }: Props) {
  if (!node)
    return (
      <div className="w-64 border-l p-3 text-sm bg-white">Select a node</div>
    );

  const set = useCallback((patch: any) => updateNode(node.id, patch), [node?.id, updateNode]);

  return (
    <div className="w-64 border-l p-3 space-y-3 text-sm bg-white overflow-y-auto">
      <h2 className="font-semibold text-base mb-2">{node.type} properties</h2>

      {/* Dynamic form based on schema */}
      {(() => {
        const typeKey = node.type as keyof typeof nodeSchemas;
        const schema = nodeSchemas[typeKey] ?? nodeSchemas.start;
        const entries = Object.entries(schema.properties) as [string, { type: string; title: string }][];
        return entries.map(([key, prop]) => {
          const value = (node.data as any)?.[key] ?? '';
          const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            set({ [key]: e.target.value });
          const isTextarea = key === 'message' || key === 'expression';
          const fieldId = `inspector-${node.id}-${key}`;
          return (
            <div key={key} className="flex flex-col gap-1">
              <label htmlFor={fieldId} className="text-xs">{prop.title}</label>
              {isTextarea ? (
                <textarea
                  id={fieldId}
                  className="border px-1 py-0.5 rounded"
                  value={value}
                  onChange={handleChange}
                />
              ) : (
                <input
                  id={fieldId}
                  type="text"
                  className="border px-1 py-0.5 rounded"
                  value={value}
                  onChange={handleChange}
                />
              )}
            </div>
          );
        });
      })()}
    </div>
  );
}
