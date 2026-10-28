import React from 'react';
import {
  FlagIcon,
  CpuChipIcon,
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

interface NodePaletteProps {
  onSelect?: (type: string) => void;
}

type Bloc = {
  type: string;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  famille: 'flux' | 'agent' | 'outil';
};

const palette: Bloc[] = [
  { type: 'start', label: 'Départ', hint: 'entrée du flow', Icon: FlagIcon, famille: 'flux' },
  { type: 'agent', label: 'Agent', hint: 'modèle et consigne', Icon: CpuChipIcon, famille: 'agent' },
  { type: 'condition', label: 'Condition', hint: 'branche vrai ou faux', Icon: ArrowsRightLeftIcon, famille: 'flux' },
  { type: 'loop', label: 'Boucle', hint: 'sur une collection', Icon: ArrowPathIcon, famille: 'flux' },
  { type: 'emailSend', label: 'Envoi email', hint: 'outil sortant', Icon: EnvelopeIcon, famille: 'outil' },
  { type: 'slackPost', label: 'Message Slack', hint: 'outil sortant', Icon: ChatBubbleLeftRightIcon, famille: 'outil' },
];

const teinte: Record<Bloc['famille'], string> = {
  flux: 'text-inkmute',
  agent: 'text-agent',
  outil: 'text-tool',
};

export default function NodePalette({ onSelect }: NodePaletteProps) {
  const onDragStart = (e: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-52 shrink-0 bg-white border-r border-line p-3 overflow-auto">
      <div className="label px-1 pb-2">Blocs</div>
      <div className="space-y-1">
        {palette.map(({ type, label, hint, Icon, famille }) => (
          <div
            key={type}
            role="button"
            tabIndex={0}
            className="group flex items-start gap-2.5 cursor-grab active:cursor-grabbing rounded-lg border border-transparent px-2.5 py-2 hover:border-line hover:bg-canvas transition-colors"
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            onClick={() => onSelect?.(type)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(type); }}
          >
            <Icon className={`w-4 h-4 mt-[3px] shrink-0 ${teinte[famille]}`} strokeWidth={1.7} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-ink leading-tight">{label}</div>
              <div className="text-[11px] text-inkmute/70 leading-tight mt-0.5">{hint}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-line px-1">
        <div className="label pb-1.5">Astuce</div>
        <p className="text-[11.5px] leading-snug text-inkmute/80">
          Glissez un bloc sur la toile, puis reliez les points pour créer une transition.
        </p>
      </div>
    </aside>
  );
}
