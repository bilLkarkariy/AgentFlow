import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
      let worker: ChildProcessWithoutNullStreams;
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

      pythonWorkerPool.acquire()
        .then((w) => {
          if (unsubscribed) {
            pythonWorkerPool.release(w);
            return;
          }
          worker = w;
          worker.stderr.on('data', (d) => this.logger.warn(`[PY] ${d.toString().trim()}`));
          worker.stdin.write(JSON.stringify(payload) + '\n');

          let buffer = '';
          const onData = (buf: Buffer) => {
            buffer += buf.toString();
            let nlIndex;
            while ((nlIndex = buffer.indexOf('\n')) >= 0) {
              const raw = buffer.slice(0, nlIndex);
              buffer = buffer.slice(nlIndex + 1);
              if (!raw.trim()) continue;
              let evt;
              try {
                evt = JSON.parse(raw);
              } catch (err) {
                onFailure('error');
                observer.error(err);
                cleanup();
                return;
              }
              if (evt.kind === 'chunk') {
                // One streamed chunk ~ one output token (see pricing README).
                tokens++;
                observer.next(evt.data);
              }
              if (evt.kind === 'end') {
                onSuccess();
                observer.complete();
                cleanup();
              }
            }
          };
          const cleanup = () => {
            worker.stdout.off('data', onData);
            pythonWorkerPool.release(worker).catch(() => worker.kill('SIGKILL'));
          };

          worker.stdout.on('data', onData);

          // Timeout handler
          const timeoutHandle = setTimeout(() => {
            this.logger.error(`Agent runner timeout after ${AgentPythonClientService.TIMEOUT_MS}ms`);
            onFailure('timeout');
            observer.error(new Error(`Agent runner timeout after ${AgentPythonClientService.TIMEOUT_MS}ms`));
            cleanup();
          }, AgentPythonClientService.TIMEOUT_MS);

          worker.once('error', (e) => { clearTimeout(timeoutHandle); onFailure('error'); observer.error(e); cleanup(); });
          worker.once('close', (code) => {
            clearTimeout(timeoutHandle);
            if (code !== 0) { onFailure('exit'); observer.error(new Error(`Worker exit ${code}`)); }
            else { onSuccess(); }
            cleanup();
          });
        })
        .catch((e) => {
          onFailure('error');
          observer.error(e);
        });

      return () => {
        unsubscribed = true;
        if (worker) {
          pythonWorkerPool.release(worker).catch(() => worker.kill('SIGKILL'));
        }
      };
    });
  }

  /**
   * Alias to run(): emits objects shaped { token: string }
   */
  runAgent(payload: Record<string, any>): Observable<{ token: string }> {
    return this.run(payload).pipe(map(data => ({ token: data })));
  }

  async onModuleDestroy(): Promise<void> {
    await pythonWorkerPool.drain();
    await pythonWorkerPool.clear();
  }
}
