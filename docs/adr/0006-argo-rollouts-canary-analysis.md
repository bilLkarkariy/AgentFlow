# 0006 — Argo Rollouts canary with a Prometheus AnalysisRun

## Status

Accepted, 2026-09-06.

## Context

A rolling update is not a deployment strategy; it is a way of changing all the
pods without anyone deciding whether the new ones are good. The thing worth
demonstrating is the decision: **shift a little traffic, measure it, and undo it
automatically if it is worse.**

That needs four pieces that must agree:

1. A controller that can hold a deployment part-way through.
2. A traffic-splitting mechanism with real weights.
3. A metric that distinguishes the new version from the old one.
4. A rule that turns that metric into abort-or-continue.

The api is also the only workload where this is meaningful: the studio and
dashboard are static SPAs whose failure mode is "the bundle 404s", which a
readiness probe already catches.

## Decision

**Argo Rollouts** canary on `agentflow-api`, with Istio traffic routing and a
`ClusterAnalysisTemplate` backed by Prometheus.

```yaml
strategy:
  canary:
    steps: [ setWeight 10, pause 60s, setWeight 50, pause 60s ]
    maxSurge: "25%"
    maxUnavailable: 0
    abortScaleDownDelaySeconds: 30
    trafficRouting:
      istio:
        virtualService:  { name: agentflow-api, routes: [primary, streaming] }
        destinationRule: { name: agentflow-api, canarySubsetName: canary,
                           stableSubsetName: stable }
    analysis:
      startingStep: 1
      templates: [{ templateName: istio-success-rate, clusterScope: true }]
```

`ClusterAnalysisTemplate istio-success-rate` runs two metrics every 30 s with
`failureLimit: 2`:

| Metric | Condition | Query shape |
|---|---|---|
| `success-rate` | `isNaN(result[0]) \|\| result[0] >= 0.95` | non-5xx `istio_requests_total` over total, both filtered by `destination_canonical_revision` = the canary's `version` label |
| `p95-latency-ms` | `isNaN(result[0]) \|\| result[0] < 1000` | `histogram_quantile(0.95, istio_request_duration_milliseconds_bucket)` on the same filter |

Both end in `or vector(1)` / `or vector(0)` and both success conditions accept
`NaN`, so the first thirty seconds — when the canary has served nothing and the
query returns no series — cannot read as a failure.

The `canary-version` argument comes from
`fieldRef: metadata.labels['version']`, and the chart derives `version` from
`image.tag`. One `yq` bump therefore keeps the pod label, the Istio canonical
revision and the analysis key in sync with no second place to edit.

## Consequences

**Positive**

- A bad deployment is reverted in about 90 seconds with no human involved, and
  the demo (`make demo-break`) shows it happening rather than describing it.
- The metric is **Envoy's**, not the application's. No instrumentation, no
  agreement needed between the app and the analysis, and it works identically for
  any service in the mesh.
- Zero-instrumentation per-version grouping via
  `destination_canonical_revision`.
- `maxUnavailable: 0` with `maxSurge: 25%` means capacity never dips during the
  rollout.
- `abortScaleDownDelaySeconds: 30` keeps the failed canary pods around for half
  a minute after an abort, which is exactly long enough to read their logs and
  say "here is why it failed" on stage.
- The same `ClusterAnalysisTemplate` is reusable by any workload; it takes the
  workload name, namespace and version as arguments.

**Negative**

- **Two controllers write one `VirtualService`.** Argo Rollouts sets the
  weights, Argo CD wants the committed state. Without global
  `ignoreDifferences` on `/spec/http/*/route/*/weight` and on the
  `DestinationRule` subsets' `rollouts-pod-template-hash` label, the Application
  flaps `Synced`/`OutOfSync` forever. This is mandatory configuration, not a
  nicety.
- **No traffic, no verdict.** With an idle service the ratio query returns no
  series, `or vector(1)` fires, and the canary is promoted having been measured
  on nothing. `scripts/loadgen.sh` exists for this reason, and
  `demo-canary.sh` starts it automatically and warns loudly when `--no-loadgen`
  is passed.
- A canary needs somewhere to shift traffic *to*, so it implies at least two
  pods during the rollout. With `replicaCount: 1` on the laptop that means a
  surge pod, which is fine, but it also means Socket.IO run state can land on
  either pod — the reason the api is one replica in the first place.
- `Rollout` is a CRD, not a `Deployment`. `kubectl rollout status` does not work,
  the HPA needs `scaleTargetRef` pointing at the `Rollout`, and anything that
  expects a `Deployment` (some dashboards, some tooling) needs teaching.
- Success rate and p95 are **symptoms**, not the SLO. A canary that is slightly
  worse but within 5 % passes.

## Alternatives considered

**Flagger** — the same idea, tied more tightly to a mesh, with automatic
generation of the routing objects. Genuinely less to write. Rejected because
Argo Rollouts pairs naturally with the Argo CD already in the cluster (one
health model, one UI, one `ignoreDifferences` story), and because its `Rollout`
CRD makes the strategy explicit in the chart rather than in a separate
`Canary` object.

**Blue/green** — simpler, and `Rollout` supports it. Rejected because the
interesting property is *measured* traffic shifting; blue/green switches 0 % to
100 % and the analysis has no partial-exposure window to measure.

**A manual approval gate instead of an analysis** — `pause: {}` and a human
promotes. That is a perfectly good production pattern and it is one line away
here. Rejected as the default because "a human looked at a dashboard" is what
the automation is meant to replace.

**Application-emitted metrics as the analysis key** (`agentflow_agent_runs_total`
by status) — closer to what users care about. Kept as a dashboard, not as the
gate, because it would make the canary depend on the correctness of the code
being canaried.

**Kayenta / automated canary analysis with baseline comparison** — statistically
sounder than a fixed threshold, and the right answer at scale. Far too much
machinery for two metrics and a laptop.

## In production I would

- **Gate on the SLO, not on a threshold.** Replace `>= 0.95` with an error-budget
  burn-rate query, so the abort condition is the same number the service
  promises its users. Sloth or Pyrra can generate the recording rules.
- **Add a smoke-test step before any traffic shift**: an `AnalysisTemplate` with
  a `Job` provider running `scripts/k6/gateway-load.js` against the canary pods
  directly, so an obviously broken build never sees a real user.
- **Longer, more gradual steps** — 5 %, 10 %, 25 %, 50 %, 100 % with 10-minute
  pauses — because a 60-second window is too short to see anything but the
  loudest failures.
- **More signals**: saturation (CPU throttling, memory), a business metric
  (`agentflow_agent_runs_total{status="failure"}`), and a `web` provider check
  against a synthetic transaction.
- **Canary the SPAs too**, once there is a metric worth aborting on — JavaScript
  error rate from RUM, not HTTP status.
- Keep `abortScaleDownDelaySeconds`, keep the `NaN` guards, and keep the
  `ignoreDifferences`. Those three are the difference between a canary that
  works and a canary that is a demo.
