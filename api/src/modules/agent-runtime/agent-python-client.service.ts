import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { Observable } from 'rxjs';
import {
  AgentMetricsService,
  AgentRunStatus,
  CircuitState,
  PythonFailureReason,
} from '../metrics/agent-metrics.service';
import { PricingService } from '../pricing/pricing.service';
import { pythonWorkerPool } from './python-worker.pool';

/**
 * Bridge to the Python agent runner (ND-JSON over stdin/stdout).
 *
 * A runner is a long-lived process taken from `pythonWorkerPool`: one JSON
 * payload per stdin line, then `chunk` events and exactly one terminal event,
 * `end` or `error`. The worker is returned to the pool or destroyed exactly
 * once per run (see `finish`).
 *
 * This is the single emission point for the agent metrics of Annexe F: every
 * run ends here exactly once with a status, a duration, a chunk count and the
 * resulting spend. The circuit breaker state is mirrored to Prometheus on each
 * transition.
 */
@Injectable()
export class AgentPythonClientService implements OnModuleDestroy {
  private static failureCount = 0;
  private static state: CircuitState = 'closed';
  private static nextAttemptTime = 0;
  private static TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS ?? '30000', 10);
  private static CB_FAILURE_THRESHOLD = parseInt(process.env.AGENT_CB_FAILURE_THRESHOLD ?? '5', 10);
  private static CB_RESET_TIMEOUT = parseInt(process.env.AGENT_CB_RESET_TIMEOUT_MS ?? '60000', 10);
  private readonly logger = new Logger(AgentPythonClientService.name);

  constructor(
    private readonly metrics: AgentMetricsService,
    private readonly pricing: PricingService,
  ) {}

  /** `model` label: first agent of the flow payload, bounded by the price list. */
  private modelOf(payload: Record<string, any>): string {
    return this.pricing.normalizeModel(
      payload?.agents?.[0]?.model ?? payload?.model ?? 'unknown',
    );
  }

  private transition(state: CircuitState): void {
    AgentPythonClientService.state = state;
    this.metrics.setCircuitState(state);
  }

  run(payload: Record<string, any>): Observable<string> {
    return new Observable<string>((observer) => {
      let worker: ChildProcessWithoutNullStreams | undefined;
      let unsubscribed = false;

      const model = this.modelOf(payload);
      const startedAt = Date.now();
      let tokens = 0;
      let settled = false;

      /** Record the outcome of this run exactly once. */
      const settle = (status: AgentRunStatus, reason?: PythonFailureReason) => {
        if (settled) return;
        settled = true;
        this.metrics.recordRun({
          model,
          status,
          durationSeconds: (Date.now() - startedAt) / 1000,
          tokens,
        });
        if (reason) this.metrics.recordPythonFailure(reason);
      };

      // Circuit breaker check
      if (AgentPythonClientService.state === 'open') {
        if (Date.now() >= AgentPythonClientService.nextAttemptTime) {
          this.transition('half_open');
        } else {
          this.logger.warn('Circuit breaker is open. Rejecting request.');
          settle('circuit_open', 'circuit_open');
          observer.error(new Error('Circuit breaker is open'));
          return;
        }
      }

      const onSuccess = () => {
        if (AgentPythonClientService.state === 'half_open') {
          this.transition('closed');
        }
        AgentPythonClientService.failureCount = 0;
        settle('success');
      };
      const onFailure = (reason: PythonFailureReason) => {
        AgentPythonClientService.failureCount++;
        if (AgentPythonClientService.failureCount >= AgentPythonClientService.CB_FAILURE_THRESHOLD) {
          this.transition('open');
          AgentPythonClientService.nextAttemptTime = Date.now() + AgentPythonClientService.CB_RESET_TIMEOUT;
          this.logger.error('Circuit breaker opened.');
        }
        settle(reason === 'timeout' ? 'timeout' : 'failure', reason);
      };

      let timeoutHandle: NodeJS.Timeout | undefined;
      let detach = () => {};
      let done = false;

      /**
       * End of this run for the worker, called once whatever the outcome.
       * A worker that answered with a terminal event is idle again and goes
       * back to the pool; any other worker (timeout, crash, garbage on stdout,
       * client gone mid-run) is in an unknown state and is destroyed.
       */
      const finish = (reusable: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timeoutHandle);
        detach();
        if (!worker) return;
        const returned = reusable
          ? pythonWorkerPool.release(worker)
          : pythonWorkerPool.destroy(worker);
        returned.catch((e) => this.logger.warn(`Worker not returned to the pool: ${e.message}`));
      };

      pythonWorkerPool.acquire()
        .then((w) => {
          if (unsubscribed) {
            pythonWorkerPool.release(w).catch(() => undefined);
            return;
          }
          worker = w;

          let buffer = '';
          const onData = (buf: Buffer) => {
            buffer += buf.toString();
            let nlIndex;
            while (!done && (nlIndex = buffer.indexOf('\n')) >= 0) {
              const raw = buffer.slice(0, nlIndex);
              buffer = buffer.slice(nlIndex + 1);
              if (!raw.trim()) continue;
              let evt;
              try {
                evt = JSON.parse(raw);
              } catch (err) {
                onFailure('error');
                finish(false);
                observer.error(err);
                return;
              }
              if (evt.kind === 'chunk') {
                // One streamed chunk ~ one output token (see pricing README).
                tokens++;
                observer.next(evt.data);
              }
              if (evt.kind === 'end') {
                onSuccess();
                finish(true);
                observer.complete();
              }
              if (evt.kind === 'error') {
                // The runner reported the failure and is waiting for the next run.
                onFailure('error');
                finish(true);
                observer.error(new Error(evt.message ?? 'Agent runner error'));
              }
            }
          };
          const onError = (e: Error) => { onFailure('error'); finish(false); observer.error(e); };
          // The runner is long-lived: it only closes mid-run when it crashed.
          const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
            onFailure('exit');
            finish(false);
            observer.error(new Error(`Worker exit ${code ?? signal}`));
          };
          detach = () => {
            w.stdout.off('data', onData);
            w.off('error', onError);
            w.off('close', onClose);
          };

          w.stdout.on('data', onData);
          w.once('error', onError);
          w.once('close', onClose);

          // Timeout handler
          timeoutHandle = setTimeout(() => {
            this.logger.error(`Agent runner timeout after ${AgentPythonClientService.TIMEOUT_MS}ms`);
            onFailure('timeout');
            finish(false);
            observer.error(new Error(`Agent runner timeout after ${AgentPythonClientService.TIMEOUT_MS}ms`));
          }, AgentPythonClientService.TIMEOUT_MS);

          w.stdin.write(JSON.stringify(payload) + '\n');
        })
        .catch((e) => {
          onFailure('error');
          finish(false);
          observer.error(e);
        });

      return () => {
        unsubscribed = true;
        // No-op after a terminal event; otherwise the run is still in flight.
        finish(false);
      };
    });
  }

  async onModuleDestroy(): Promise<void> {
    await pythonWorkerPool.drain();
    await pythonWorkerPool.clear();
  }
}
