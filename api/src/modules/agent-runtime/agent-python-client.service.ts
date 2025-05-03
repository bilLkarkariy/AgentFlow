import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { pythonWorkerPool } from './python-worker.pool';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { Counter, register } from 'prom-client';

@Injectable()
export class AgentPythonClientService implements OnModuleDestroy {
  private static failureCount = 0;
  private static state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private static nextAttemptTime = 0;
  private static TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS ?? '30000', 10);
  private static CB_FAILURE_THRESHOLD = parseInt(process.env.AGENT_CB_FAILURE_THRESHOLD ?? '5', 10);
  private static CB_RESET_TIMEOUT = parseInt(process.env.AGENT_CB_RESET_TIMEOUT_MS ?? '60000', 10);
  private readonly logger = new Logger(AgentPythonClientService.name);
  private readonly failureCounter = new Counter({ name: 'agent_python_failures_total', help: 'Nombre d’échecs du runner Python', registers: [register] });

  run(payload: Record<string, any>): Observable<string> {
    return new Observable<string>((observer) => {
      let worker: ChildProcessWithoutNullStreams;
      let unsubscribed = false;

      // Circuit breaker check
      if (AgentPythonClientService.state === 'OPEN') {
        if (Date.now() >= AgentPythonClientService.nextAttemptTime) {
          AgentPythonClientService.state = 'HALF_OPEN';
        } else {
          this.logger.warn('Circuit breaker is open. Rejecting request.');
          observer.error(new Error('Circuit breaker is open'));
          return;
        }
      }
      const onSuccess = () => {
        if (AgentPythonClientService.state === 'HALF_OPEN') {
          AgentPythonClientService.state = 'CLOSED';
        }
        AgentPythonClientService.failureCount = 0;
      };
      const onFailure = () => {
        AgentPythonClientService.failureCount++;
        if (AgentPythonClientService.failureCount >= AgentPythonClientService.CB_FAILURE_THRESHOLD) {
          AgentPythonClientService.state = 'OPEN';
          AgentPythonClientService.nextAttemptTime = Date.now() + AgentPythonClientService.CB_RESET_TIMEOUT;
          this.logger.error('Circuit breaker opened.');
        }
        this.failureCounter.inc();
      };

      pythonWorkerPool.acquire()
        .then((w) => {
          if (unsubscribed) {
            pythonWorkerPool.release(w);
            return;
          }
          worker = w;
          worker.stderr.on('data', (d) => console.error('[PY]', d.toString()));
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
                observer.error(err);
                cleanup();
                return;
              }
              if (evt.kind === 'chunk') observer.next(evt.data);
              if (evt.kind === 'end') {
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
            observer.error(new Error(`Agent runner timeout after ${AgentPythonClientService.TIMEOUT_MS}ms`));
            cleanup(); onFailure();
          }, AgentPythonClientService.TIMEOUT_MS);

          worker.once('error', (e) => { clearTimeout(timeoutHandle); onFailure(); observer.error(e); cleanup(); });
          worker.once('close', (code) => {
            clearTimeout(timeoutHandle);
            if (code !== 0) { onFailure(); observer.error(new Error(`Worker exit ${code}`)); }
            else { onSuccess(); }
            cleanup();
          });
        })
        .catch((e) => observer.error(e));

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
