import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  FlagIcon,
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/24/outline';

type Meta = {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  defaut: string;
  spine: string;
  teinte: string;
};

const meta: Record<string, Meta> = {
  start:      { Icon: FlagIcon,                 defaut: 'Départ',        spine: 'bg-ink',   teinte: 'text-ink' },
  condition:  { Icon: ArrowsRightLeftIcon,      defaut: 'Condition',     spine: 'bg-inkmute', teinte: 'text-inkmute' },
  loop:       { Icon: ArrowPathIcon,            defaut: 'Boucle',        spine: 'bg-inkmute', teinte: 'text-inkmute' },
  emailSend:  { Icon: EnvelopeIcon,             defaut: 'Envoi email',   spine: 'bg-tool',  teinte: 'text-tool' },
  slackPost:  { Icon: ChatBubbleLeftRightIcon,  defaut: 'Message Slack', spine: 'bg-tool',  teinte: 'text-tool' },
  integration:{ Icon: PuzzlePieceIcon,          defaut: 'Intégration',   spine: 'bg-tool',  teinte: 'text-tool' },
};

const point = '!w-2 !h-2 !bg-white !border-2 !border-line';

function NodeBox({ data, type, selected }: NodeProps) {
  const m = meta[type ?? ''] ?? { Icon: PuzzlePieceIcon, defaut: type ?? 'Bloc', spine: 'bg-inkmute', teinte: 'text-inkmute' };
  const titre = data?.label ?? m.defaut;

  const coque = [
    'relative flex items-center gap-2 pl-4 pr-3.5 py-2.5 rounded-xl bg-white border transition-all duration-150',
    selected ? 'border-agent shadow-lg shadow-agent/10' : 'border-line shadow-sm hover:shadow-md',
  ].join(' ');

  const corps = (
    <>
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${m.spine}`} />
      <m.Icon className={`w-[15px] h-[15px] shrink-0 ${m.teinte}`} strokeWidth={1.8} />
      <span className="text-[13px] font-semibold text-ink leading-tight whitespace-nowrap">{titre}</span>
    </>
  );

  if (type === 'condition') {
    return (
      <div className={coque}>
        <Handle type="target" position={Position.Left} className={point} />
        {corps}
        <Handle id="true" type="source" position={Position.Right} style={{ top: '35%' }} className={point} />
        <Handle id="false" type="source" position={Position.Right} style={{ top: '70%' }} className={point} />
      </div>
    );
  }

  if (type === 'start') {
    return (
      <div className={coque}>
        {corps}
        <Handle type="source" position={Position.Right} className={point} />
      </div>
    );
  }

  if (type === 'loop') {
    return (
      <div className={coque}>
        <Handle type="target" position={Position.Left} className={point} />
        {corps}
        <Handle id="body" type="source" position={Position.Right} style={{ top: '35%' }} className={point} />
        <Handle id="next" type="source" position={Position.Right} style={{ top: '70%' }} className={point} />
      </div>
    );
  }

  return (
    <div className={coque}>
      <Handle type="target" position={Position.Left} className={point} />
      {corps}
      <Handle type="source" position={Position.Right} className={point} />
    </div>
  );
}

export default memo(NodeBox);
