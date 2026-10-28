# 0007 — Kyverno for admission policy, including keyless cosign verification

## Status

Accepted, 2026-09-06.

## Context

CI already scans with Trivy and signs with cosign. That proves something about
the artifact at build time. It proves nothing about what is *running*: a cluster
will happily start an image nobody scanned, signed or even built here.

Closing that gap needs an admission controller. It also needs a few duller
rules, each of which exists because of a specific failure this platform can
have:

- **No `latest`** — GitOps pins `image.tag` to `sha-<7>`; an unpinnable tag makes
  desired state unknowable and a rollback meaningless.
- **Memory limit and CPU request** — one pod must not be able to OOM the whole
  kind node, and the scheduler needs something to bin-pack on.
- **Non-root** — the chart already sets it; the policy is what makes it true for
  anything that did not come from the chart.

## Decision

**Kyverno**, four `ClusterPolicy` objects in
`deploy/platform/kyverno/policies/base`, with kustomize overlays per
environment:

| Policy | Rule | local | aws |
|---|---|---|---|
| `require-resource-limits` | `resources.limits.memory` and `resources.requests.cpu` on every application container | Enforce | Enforce |
| `disallow-latest-tag` | explicit tag, not `latest`, containers **and** init containers | Enforce | Enforce |
| `require-run-as-nonroot` | `runAsNonRoot` on all containers, and on init containers except `istio-init` | Enforce | Enforce |
| `verify-image-signatures` | keyless cosign, issuer `https://token.actions.githubusercontent.com`, `subjectRegExp` matching this repository's workflows | **Audit**, `mutateDigest: false` | **Enforce**, `mutateDigest: true` |

Kyverno itself runs with 1 replica and the reports and cleanup controllers off,
and its webhooks exclude the platform namespaces — otherwise a Kyverno outage
takes the cluster's own control plane components with it.

Two details that took thought:

- **`mutateDigest: true`** rewrites the tag to the digest that was actually
  verified, closing the window in which a tag could be repointed between the
  admission check and the kubelet's pull.
- **The `istio-init` carve-out lives inside the rule**, iterating over
  `spec.initContainers[?name != 'istio-init']`, not in a `PolicyException`. A
  `PolicyException`'s unit is the *resource*: one matching the `agentflow` pods
  would switch the policy off for the whole pod, application containers
  included, which is precisely what must stay enforced.

## Consequences

**Positive**

- The supply chain is enforced where it matters: at admission, on the thing that
  is about to run, not only in a pipeline that can be bypassed.
- Keyless signing means there is **no key to steal**. The signature's identity is
  "this workflow, in this repository, at this ref", recorded in Rekor.
- `scripts/verify-security.sh` proves all of it end to end by trying to create an
  offending pod and expecting the API server to say no. A policy nobody tests is
  a policy that is silently in `Audit`.
- The rules are readable YAML with a header explaining *why*, which is
  documentation that cannot drift from the enforcement.
- `kyverno apply ... -r tests/*.yaml` runs the whole suite in CI with no cluster.

**Negative**

- **Another admission webhook in the request path.** One replica means a Kyverno
  restart is a brief window where pod creation fails. Fine on a laptop, not fine
  in production.
- **`Audit` locally** is a real weakening: kind has no guaranteed egress to
  Fulcio and Rekor, and `make local-images` side-loads unsigned images by design.
  So the policy that matters most is the one that is only enforced in the
  environment that costs money.
- Kyverno also refuses `mutateDigest: true` alongside an `Audit` failure action
  (an audit rule must not rewrite what it only observes), so the two fields have
  to be patched together in the overlays — a subtlety that will bite whoever
  edits one without the other.
- Signature verification adds a network call to Fulcio/Rekor on every admission
  of a new digest. Cached, but it is a dependency on an external service in the
  pod-creation path.
- The reports controller is off to save memory, so violations are **blocked but
  not reported**. There is no `PolicyReport` to look at.
- `require-resource-limits` deliberately does **not** require a CPU limit. That
  is a considered position — CFS throttling costs more latency than it saves —
  but it is a position, and some organisations mandate the opposite.

## Alternatives considered

**Gatekeeper / OPA** — the incumbent, and Rego is more expressive than Kyverno's
YAML for genuinely complex logic. Rejected because these four policies are not
complex, because Kyverno policies are readable by someone who has never seen
Rego, and above all because Kyverno has **native `verifyImages`** with cosign:
with Gatekeeper, signature verification means running a separate policy
controller or an external data provider.

**Sigstore Policy Controller** — purpose-built for exactly the signature rule
and arguably better at it. Rejected because it would be a second admission
controller alongside whatever handles the other three policies; one is enough.

**Kyverno `validate` only, no `verifyImages`** — simpler, and leaves signature
checking in CI. Rejected because "CI checked it" is not a property of the
cluster.

**Pod Security Admission alone** — built in, free, no webhook. It covers
non-root and privilege escalation well and is enabled here at `warn: restricted`.
It cannot express "no `latest`", "memory limit required" or anything about
signatures, and its unit is the namespace, so `istio-init` forces the whole
namespace down a level. It is a floor, not a policy engine.

**Admission-time image scanning** (Trivy operator as a gate) — scanning at
admission is the wrong time: the scan takes seconds to minutes and the answer
changes daily. Scan in CI, re-scan continuously, gate on signature.

## In production I would

- **Enforce the signature policy everywhere**, including non-production. That
  means either egress to Fulcio and Rekor from every cluster, or a Rekor mirror /
  `--offline-bundle` verification path for air-gapped ones. `Audit` in one
  environment and `Enforce` in another means the rule is tested where it does not
  matter.
- **Verify attestations, not just signatures.** The SBOM is already attested;
  add a `verifyImages.attestations` rule requiring SLSA provenance whose
  `buildDefinition` names this repository and this workflow, so "built by us,
  from this commit" is an admission requirement.
- **Restrict registries** to the organisation's own, so a typo'd image name
  fails at admission rather than pulling something from the internet.
- **Kyverno HA**: 3 replicas, a `PodDisruptionBudget`, and `failurePolicy`
  chosen deliberately per policy — `Fail` for the security rules, `Ignore` for
  the cosmetic ones, so a controller outage degrades rather than stops.
- **Turn the reports controller on** and surface `PolicyReport` in Grafana, so
  drift is visible and not only blocked.
- **Add governance rules**: required labels and owner annotations, a mandatory
  `runbook_url` on every `PrometheusRule`, no `NodePort`, no `hostNetwork`.
- Roll every new policy out in `Audit` first, look at the reports for a week,
  then flip to `Enforce`. Shipping a policy straight to `Enforce` is how a
  platform team becomes the reason nobody can deploy.
