/**
 * Shared domain types: Flow logs
 */
export interface FlowLogEvent {
  runId: string;
  nodeId: string;
  status: 'success' | 'error' | 'info';
  timestamp: number;
  message: string;
}
