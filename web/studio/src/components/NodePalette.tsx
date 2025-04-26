import React from 'react';

interface NodePaletteProps {
  onSelect?: (type: string) => void;
}

const palette: { type: string; label: string }[] = [
  { type: 'start', label: 'Start' },
  { type: 'emailSend', label: 'Email Send' },
  { type: 'slackPost', label: 'Slack Post' },
  { type: 'condition', label: 'Condition' },
  { type: 'loop', label: 'Loop' },
  { type: 'agent', label: 'Agent Block' },
];

export default function NodePalette({ onSelect }: NodePaletteProps) {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="space-y-2 p-2 w-40 bg-gray-100 border-r">
      {palette.map((n) => (
        <div
          key={n.type}
          className="cursor-grab p-2 bg-white rounded shadow text-sm text-center"
          draggable
          onDragStart={(e) => onDragStart(e, n.type)}
          onClick={() => onSelect?.(n.type)}
        >
          {n.label}
        </div>
      ))}
    </div>
  );
}
