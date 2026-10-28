import type { NextFunction, Request, Response } from 'express';

/** Probes and scrapes are never broken: the canary analysis relies on them. */
const SAFE_PATHS = /^\/(health|metrics)/;

/**
 * Fault injection used by the canary rollback demo.
 *
 * `CHAOS_ERROR_RATE` is a probability in [0, 1]: each request has that chance
 * of getting a plain 500 instead of reaching the router, which makes the Istio
 * success-rate AnalysisRun fail and Argo Rollouts abort the canary.
 *
 * The variable is read on every request (not cached at boot) so a test can set
 * it in-process. In Kubernetes it is set through the chart values / ConfigMap,
 * which restarts the pods anyway.
 */
export function chaosMiddleware(req: Request, res: Response, next: NextFunction): void {
  const rate = Number(process.env.CHAOS_ERROR_RATE);
  if (
    Number.isFinite(rate) &&
    rate > 0 &&
    !SAFE_PATHS.test(req.path ?? req.url ?? '') &&
    Math.random() < rate
  ) {
    res.status(500).json({ error: 'chaos' });
    return;
  }
  next();
}
