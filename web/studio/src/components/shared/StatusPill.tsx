import React from 'react';

interface StatusPillProps {
  status: string;
}

const colorMap: Record<string, string> = {
  success: 'green',
  error: 'red',
  running: 'yellow',
};

const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  const color = colorMap[status] || 'gray';
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium bg-${color}-100 text-${color}-800 capitalize`}
    >
      {status}
    </span>
  );
};

export default StatusPill;
