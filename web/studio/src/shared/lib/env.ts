/**
 * Centralised environment resolution usable in browser (Vite) AND in Node (Jest).
 */
export const API_BASE_URL =
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE_URL : undefined) ||
  'http://localhost:3000';

export const AGENT_RUNTIME_URL =
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_AGENT_RUNTIME_URL : undefined) ||
  'http://localhost:8000';
