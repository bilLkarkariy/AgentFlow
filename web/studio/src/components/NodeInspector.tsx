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
  // Les hooks doivent etre appeles avant tout return conditionnel (React #310).
  const set = useCallback((patch: any) => { if (node) updateNode(node.id, patch); }, [node?.id, updateNode]);

  if (!node)
    return (
      <div className="text-[13px] text-inkmute/70">
        <div className="label pb-2">Propriétés</div>
        Sélectionnez un bloc pour voir ses propriétés.
      </div>
    );

  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="label">Propriétés</div>
        <h2 className="text-[14px] font-semibold text-ink mt-1.5">{(node.data as any)?.label ?? node.type}</h2>
        <div className="measure mt-0.5">{node.type}</div>
      </div>

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
              <label htmlFor={fieldId} className="text-[11.5px] font-medium text-inkmute">{prop.title}</label>
              {isTextarea ? (
                <textarea
                  id={fieldId}
                  className="border border-line rounded-md px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:border-agent"
                  value={value}
                  onChange={handleChange}
                />
              ) : (
                <input
                  id={fieldId}
                  type="text"
                  className="border border-line rounded-md px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:border-agent"
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
