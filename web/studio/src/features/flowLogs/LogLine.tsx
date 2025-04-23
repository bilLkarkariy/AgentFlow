import React from 'react';
import { FlowLogEvent } from './socket';

const color = {
  success: 'text-green-400',
  error: 'text-red-400',
  info: 'text-blue-400',
};

const LogLine: React.FC<{ log: FlowLogEvent }> = ({ log }) => (
  <li className={`whitespace-pre ${color[log.status]}`}>{log.message}</li>
);

export default LogLine;
