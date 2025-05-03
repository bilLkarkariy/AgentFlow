/**
 * Shared domain types: Run
 */
export interface Run {
  id: string;
  startedAt: string;
  status: string;
  endedAt?: string;
}
