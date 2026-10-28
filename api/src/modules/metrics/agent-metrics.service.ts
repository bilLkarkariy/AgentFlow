import { Injectable } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import {
  getOrCreateCounter,
  getOrCreateGauge,
  getOrCreateHistogram,
} from './prom-registry';

export type AgentRunStatus = 'success' | 'failure' | 'timeout' | 'circuit_open';
export type PythonFailureReason = 'timeout' | 'exit' | 'error' | 'circuit_open';
export type CircuitState = 'closed' | 'half_open' | 'open';

const PYTHON_FAILURE_REASONS: PythonFailureReason[] = [
  'timeout',
  'exit',
  'error',
  'circuit_open',
];

/** Numeric encoding of the breaker for `agentflow_python_runner_circuit_state`. */
const CIRCUIT_STATE_VALUE: Record<CircuitState, number> = {
  closed: 0,
  half_open: 1,
  open: 2,
};

export interface AgentRunSample {
  model?: string | null;
  status: AgentRunStatus;
  /** Wall clock duration of the run, in seconds. */
  durationSeconds: number;
  /** Streamed chunks, used as an approximation of output tokens. */
  tokens: number;
}

/**
 * Owns every `agentflow_*` application metric (plan Annexe F).
 *
 * Labels are deliberately low cardinality: `model` is bounded by
 * `PricingService.normalizeModel()` and there is no `jobId` anywhere.
 */
@Injectable()
export class AgentMetricsService {
  private readonly runs = getOrCreateCounter({
    name: 'agentflow_agent_runs_total',
    help: 'Agent runs executed by the Python runner, by model and outcome',
    labelNames: ['model', 'status'],
  });

  private readonly runDuration = getOrCreateHistogram({
    name: 'agentflow_agent_run_duration_seconds',
    help: 'Wall clock duration of an agent run, in seconds',
    labelNames: ['model'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  });

  private readonly tokens = getOrCreateCounter({
    name: 'agentflow_llm_tokens_total',
    help: 'LLM tokens, approximated from streamed chunks',
    labelNames: ['model', 'type'],
  });

  private readonly cost = getOrCreateCounter({
    name: 'agentflow_llm_cost_usd_total',
    help: 'Estimated LLM spend in USD, from src/pricing.json (illustrative rates)',
    labelNames: ['model'],
  });

  private readonly queueDepth = getOrCreateGauge({
    name: 'agentflow_queue_depth',
    help: 'Jobs in a BullMQ queue, by state',
    labelNames: ['queue', 'state'],
  });

  private readonly pythonFailures = getOrCreateCounter({
    name: 'agentflow_python_runner_failures_total',
    help: 'Python runner failures, by reason',
    labelNames: ['reason'],
  });

  private readonly circuitState = getOrCreateGauge({
    name: 'agentflow_python_runner_circuit_state',
    help: 'Python runner circuit breaker: 0 closed, 1 half-open, 2 open',
  });

  private readonly buildInfo = getOrCreateGauge({
    name: 'agentflow_build_info',
    help: 'Build metadata of the running api, always 1',
    labelNames: ['version', 'commit'],
  });

  constructor(private readonly pricing: PricingService) {
    this.buildInfo.set(
      {
        version: process.env.APP_VERSION ?? 'dev',
        commit: process.env.GIT_SHA ?? 'unknown',
      },
      1,
    );
    this.circuitState.set(CIRCUIT_STATE_VALUE.closed);
    // Expose the failure series at 0 so `increase()` works from the very first
    // scrape of a fresh pod instead of showing "No data".
    for (const reason of PYTHON_FAILURE_REASONS) {
      this.pythonFailures.inc({ reason }, 0);
    }
  }

  /** Single call made at the end of an agent run: counters, duration, spend. */
  recordRun({ model, status, durationSeconds, tokens }: AgentRunSample): void {
    const normalized = this.pricing.normalizeModel(model);
    this.runs.inc({ model: normalized, status });
    this.runDuration.observe({ model: normalized }, Math.max(durationSeconds, 0));
    if (tokens > 0) {
      this.tokens.inc({ model: normalized, type: 'output' }, tokens);
      this.cost.inc({ model: normalized }, this.pricing.costFor(normalized, tokens));
    }
  }

  recordPythonFailure(reason: PythonFailureReason): void {
    this.pythonFailures.inc({ reason });
  }

  setCircuitState(state: CircuitState): void {
    this.circuitState.set(CIRCUIT_STATE_VALUE[state]);
  }

  setQueueDepth(queue: string, state: string, value: number): void {
    this.queueDepth.set({ queue, state }, value);
  }
}
