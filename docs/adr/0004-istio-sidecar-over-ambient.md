# 0004 — Istio sidecar mode rather than ambient

## Status

Accepted, 2026-09-06.

## Context

The centrepiece of this platform is a canary deployment that is **measured** and
rolled back automatically. That needs three things from the mesh:

1. **Weighted traffic splitting** between two versions of the same service.
2. **Per-version telemetry** — the success rate of the canary specifically, not
   of the service as a whole.
3. mTLS, so "the mesh is doing something real" is provable.

Argo Rollouts' Istio integration drives this by rewriting a `VirtualService`'s
route weights and pointing them at `DestinationRule` subsets named `stable` and
`canary`, which select on the `rollouts-pod-template-hash` label. The analysis
then queries `istio_requests_total` filtered by
`destination_canonical_revision`, which Istio derives from the pod's `version`
label.

Ambient mode (ztunnel for L4, waypoint proxies for L7) is the direction Istio is
going: no sidecar, faster pod startup, much lower per-pod memory. On a 10 GiB
laptop VM running twenty platform components, "much lower per-pod memory" is not
a small argument.

## Decision

**Istio 1.30.x in sidecar mode**, `PeerAuthentication` STRICT in the `agentflow`
namespace, `istio-injection=enabled` on the namespace, gateway release
`istio-ingressgateway` in `istio-ingress`.

- Local (kind): the default init-container dataplane (`istio-init` programs
  iptables).
- AWS: `istio-cni` enabled, so no privileged init container is injected at all.
- Telemetry to Tempo through an `extensionProviders` entry pointing at the OTel
  collector.
- `proxy.istio.io/config: '{"holdApplicationUntilProxyStarts": true}'` on the
  api, so the app cannot start before Envoy is ready and fail its first outbound
  calls.

## Consequences

**Positive**

- The Argo Rollouts Istio integration works exactly as documented: named routes
  `primary` and `streaming`, subsets `stable` and `canary`, weights rewritten by
  the controller.
- Kiali's **versioned app graph** shows two versions of `api` behind one service
  with the traffic split as edge thickness, read from Envoy's own telemetry.
  Nobody tells Kiali about the deployment. That is the single most convincing
  thirty seconds of the demo.
- `destination_canonical_revision` gives the AnalysisRun a clean per-version
  grouping key with no application instrumentation at all.
- mTLS STRICT is provable the only way that counts: a pod with no sidecar is
  refused, and `scripts/verify-security.sh` runs exactly that test.
- Sidecar mode is what most Istio installations in the wild still are, so the
  operational knowledge transfers.

**Negative**

- **Memory.** ~64-100 MiB of Envoy per pod. Across the application namespace and
  the ingress gateway that is a meaningful slice of a 10 GiB VM, and it is why
  the proxy resources are pinned at `10m/64Mi` request, `256Mi` limit.
- **Slower pod startup**, made deliberately slower still by
  `holdApplicationUntilProxyStarts`.
- **`istio-init` runs as uid 0 with `NET_ADMIN`/`NET_RAW`** on kind. That forces
  the `agentflow` namespace to Pod Security `warn: restricted` rather than
  `enforce`, and it forces a carve-out in the `require-run-as-nonroot` Kyverno
  policy — written into the rule rather than as a `PolicyException`, because an
  exception's unit is the whole pod. AWS avoids this with `istio-cni`.
- **Jobs need `sidecar.istio.io/inject: "false"`.** The migration Job would
  otherwise never terminate, because Envoy keeps running after the main
  container exits. This is a classic and it is annotated in the chart.
- Two controllers write the same `VirtualService`: Argo Rollouts sets the
  weights, Argo CD wants the Git state. Global `ignoreDifferences` on
  `/spec/http/*/route/*/weight` and on the `DestinationRule` subset labels are
  **mandatory** before the first canary, or the Application flaps forever.

## Alternatives considered

**Istio ambient mode** — better on every resource axis and the obvious future.
Rejected for this demo because the Argo Rollouts Istio provider is written
against the sidecar contract (`VirtualService` weights + `DestinationRule`
subsets). Ambient can do weighted routing through a waypoint proxy, but the
integration is less travelled, the per-version telemetry labels differ, and the
Kiali versioned-app graph is built on sidecar reporting. Choosing ambient would
have meant debugging the mesh instead of demonstrating progressive delivery.

**Linkerd** — lighter, simpler, excellent mTLS, and it has a first-class
`TrafficSplit`/`HTTPRoute` story that Argo Rollouts supports (SMI). Rejected
because Istio is what the target roles ask about, and because Linkerd's
`ServiceProfile`-based metrics are less directly usable as a canary analysis key
than `destination_canonical_revision`.

**Gateway API with `HTTPRoute` weights, no mesh** — enough for traffic
splitting, and Argo Rollouts supports the Gateway API plugin. Rejected because
it gives no mTLS, no per-version telemetry without instrumenting the
application, and no service graph. The mesh is not there for the routing; it is
there for the measurement.

**No mesh, `Service`-based canary (two Deployments, one Service)** — the
poor-man's canary: the split is whatever the endpoint ratio happens to be. No
weights, no analysis key, no rollback signal. That is the thing this platform
exists to be better than.

## In production I would

Start from the workload, not from the mesh:

- **Ambient by default** for the long tail of services that need mTLS and L4
  telemetry and nothing else. That is most services, and the per-pod saving is
  real money at scale.
- **Waypoint proxies** only for the namespaces that need L7: header-based
  routing, retries, per-route timeouts, and progressive delivery. Pay for Envoy
  where Envoy earns it.
- Add **`AuthorizationPolicy`** everywhere, which this demo does not have.
  `PeerAuthentication` STRICT proves *who* is calling; only
  `AuthorizationPolicy` expresses *what they may do*. Default-deny per namespace,
  then explicit allows.
- Enable **`istio-cni`** in every environment, so no privileged init container
  is ever injected and Pod Security can move from `warn` to `enforce`.
- Pin the Istio minor version in `deploy/versions.yaml` (it already is) and
  follow the **revision-based upgrade** path (`istio.io/rev` labels, canary
  control planes) rather than in-place upgrades.
- Keep `holdApplicationUntilProxyStarts` and the Job injection opt-out. Those
  two lines prevent more incidents than most of the rest.
