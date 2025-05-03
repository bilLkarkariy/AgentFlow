import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const typeToColor: Record<string, string> = {
  emailSend: 'bg-blue-500',
  slackPost: 'bg-green-500',
  condition: 'bg-yellow-500',
  loop: 'bg-purple-500',
  start: 'bg-gray-800',
};

function NodeBox({ data, type }: NodeProps) {
  const color = typeToColor[type ?? ''] ?? 'bg-gray-500';

  if (type === 'condition') {
    return (
      <div className={`text-white text-sm px-3 py-2 rounded shadow ${color}`}> 
        <Handle type="target" position={Position.Top} />
        <div className="font-semibold">{data?.label ?? 'Condition'}</div>
        {/* two outputs */}
        <Handle id="true" type="source" position={Position.Bottom} style={{ left: '25%' }} />
        <Handle id="false" type="source" position={Position.Bottom} style={{ left: '75%' }} />
      </div>
    );
  }

  if (type === 'start') {
    return (
      <div className={`text-white text-sm px-3 py-2 rounded-full shadow ${color}`}> 
        <div className="font-semibold">Start</div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  if (type === 'loop') {
    return (
      <div className={`text-white text-sm px-3 py-2 rounded shadow ${color}`}> 
        <Handle type="target" position={Position.Top} />
        <div className="font-semibold">{data?.label ?? 'Loop'}</div>
        {/* Loop body */}
        <Handle id="body" type="source" position={Position.Bottom} style={{ left: '25%' }} />
        {/* Loop exit */}
        <Handle id="next" type="source" position={Position.Bottom} style={{ left: '75%' }} />
      </div>
    );
  }

  return (
    <div className={`text-white text-sm px-3 py-2 rounded shadow ${color}`}> 
      <Handle type="target" position={Position.Top} />
      <div className="font-semibold">{data?.label ?? type}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(NodeBox);
