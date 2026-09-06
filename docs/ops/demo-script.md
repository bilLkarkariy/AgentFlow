# Demo script: 10 minutes

One story, told once: **a commit becomes a canary, the canary is measured, and
a bad one rolls itself back.** Everything else is scenery.

The script below assumes the AWS environment. It works line for line on the
local kind cluster too: swap `https://api.<domain>` for
`http://api.127.0.0.1.sslip.io`, drop `DEMO_ENV=aws`, and skip the teardown.
Running it locally is also the safer choice if the venue's network is unknown.

---

## T-45: setup checklist

Do this before anyone is watching. It is 25 minutes of waiting plus 20 of
checking.

| # | Do | Confirm |
|---|---|---|
| 1 | `make aws-up` | ends with the URL report, no error |
| 2 | `make aws-ui` in its own terminal, leave it running | Argo CD, Grafana, Kiali, Rollouts all answer on localhost |
| 3 | `make aws-trust-ca`, then `make aws-status` | the URLs print; `https://api.<domain>/health` in the browser: no warning |
| 4 | `kubectl -n argocd get applications.argoproj.io` | every row `Synced` / `Healthy` |
| 5 | `kubectl -n agentflow get pods` | every app pod `2/2` |
| 6 | `curl -s https://api.<domain>/health/ready` | `"status":"ok"`, all three checks up |
| 7 | Open Studio, run one agent | it succeeds; this seeds the LLM cost dashboard |
| 8 | `scripts/loadgen.sh --host api.<domain> --url https://<domain> --duration 45m &` | Grafana `agentflow-overview` shows a request rate |
| 9 | Grafana `/d/agentflow-canary` and `/d/agentflow-overview` | both have data, not "No data" |
| 10 | Kiali graph, namespace `agentflow`, **Versioned app** | the mesh graph is drawn |
| 11 | `make demo-tag` | note the tag currently deployed; you will reuse it |
| 12 | Have a trivial source change ready to push | e.g. a log string, one line |
| 13 | `gh run list --limit 3` | you are logged in and can see runs |
| 14 | Tabs, in order, left to right | Argo CD, Actions, Kiali, Grafana, Rollouts, terminal |
| 15 | Terminal font size up, `clear`, `unset` any noisy prompt | readable from three metres |

Fallback material, prepared in advance: a screen recording of a full
`make demo-break` cycle, and the Actions run of a previous successful build.
Network failures during a live demo are not a story about your engineering.

---

## The 10 minutes

| Min | Action | Command | What you say | If it fails |
|---|---|---|---|---|
| 0:00 | The picture | `make aws-status`, then show [`architecture.md`](architecture.md) diagram 1 | "EKS in one AZ, spot Graviton nodes in public subnets, no NAT. RDS behind the node security group. GitHub Actions gets in through OIDC, Argo CD pulls. It costs 24 cents an hour and it did not exist an hour ago." | Show the diagram alone; the output is decoration |
| 1:00 | GitOps, not kubectl | Argo CD tab: the `platform-root` tree | "Terraform created two things: the cluster and Argo CD. Everything else, 20 Applications in sync waves, is reconciled from this repository. `deploy/platform/bootstrap` is a catalogue: a component is a row in a values file, not a Helm command someone ran once." | `kubectl -n argocd get applications.argoproj.io` in the terminal |
| 2:00 | Push | `git commit -am 'feat: demo' && git push` | "The pipeline is not a deploy step. It builds, scans, signs, and then edits one line of YAML." | Open a previous run instead and narrate it |
| 2:30 | The pipeline | Actions tab, watch `build-images.yml` | "Four services, two architectures, pushed by digest and merged into one multi-arch tag. Trivy fails the build on CRITICAL and uploads SARIF to the Security tab. Cosign signs keyless, so the signature is tied to this workflow's OIDC identity, not to a key someone could copy. An SBOM is attached as an attestation." | The recording, or the Security tab of the last run |
| 3:30 | The deploy is a commit | `git log --oneline -3 -- deploy/envs/aws/api.yaml` | "The last job writes `image.tag`. That commit *is* the deployment. `git log` on this file is the deployment history, and a rollback is a revert." | Show the file in GitHub |
| 4:00 | Canary | `make demo-canary DEMO_ENV=aws TAG=sha-<new>` | "One line changes, Argo CD syncs, Argo Rollouts starts shifting traffic: 10 %, pause, 50 %, pause, 100 %." | `kubectl argo rollouts get rollout agentflow-api -n agentflow -w` |
| 4:30 | Watch it shift | Rollouts tab + Kiali tab, Versioned app graph | "Kiali is showing the mesh from Envoy's own telemetry. Two versions of `api` behind one service, and the edge thickness is the traffic split. Nobody told Kiali about the deployment; it is reading `istio_requests_total`." | The `rollouts get -w` output already on screen is enough |
| 5:30 | It is measured | Rollouts tab: the `AnalysisRun` | "Every 30 seconds an AnalysisRun asks Prometheus for the canary's success rate and p95, grouped by `destination_canonical_revision`, which is the pod's `version` label, which is the image tag. Two consecutive failures abort it." | `kubectl -n agentflow get analysisrun` |
| 6:00 | Observability | Grafana `/d/agentflow-overview`, then the Loki panel, then a trace | "Same RED metrics, split by version, so 'is the canary worse' is one panel and not an argument. Logs are JSON with a `trace_id`, so a log line links straight to its Tempo trace." | Any one of the three is enough; do not fight three tools live |
| 7:00 | Break it | `make demo-break DEMO_ENV=aws TAG=sha-<new>` | "Same tag, one extra environment variable: `CHAOS_ERROR_RATE=0.3`. The api now returns 500 on 30 % of real requests, and never on `/health`, because a health check that lies is not a demo, it is a bug." | The recording |
| 7:30 | It rolls back | Rollouts tab, then Kiali | "AnalysisRun `Failed`, Rollout `Degraded`, traffic back to 100 % stable. Nobody paged anyone. The cluster is correct and Git is now wrong, so the fix is `git revert` — the script prints the exact command." | `kubectl -n agentflow get analysisrun` and read the status |
| 8:30 | The gate | `kubectl -n agentflow run bad --image=nginx:latest` | "Kyverno: no `latest`, no root, no missing memory limit. On AWS the signature policy is `Enforce`, so an image this pipeline did not sign is not admitted, and the tag is rewritten to the verified digest so nothing can be swapped in between." | `scripts/verify-security.sh` prints the same three refusals |
| 9:00 | Teardown, and talk | `make aws-down` (leave it running) | Talk over it: [`interview-talking-points.md`](interview-talking-points.md). Multi-AZ, Karpenter, private subnets, Aurora, Thanos, SLOs. | Nothing to fail here |
| 10:00 | Prove it | `make aws-check-clean` | "Load balancers and EBS volumes belong to Kubernetes, not to Terraform, so the teardown deletes them first and then checks. Unassociated Elastic IPs are the classic silent 4 dollars a month." | Run it later and mention the budget alert |

Two rules for the ten minutes: **never open a terminal you have not already
used**, and **when something is slow, keep talking about why it is slow.** The
25-minute EKS creation is a fact about EKS, and knowing that is part of the
answer.

---

## Questions they will ask

**Why sidecar Istio and not ambient?**
Ambient is the better answer for cost and for pod startup, and it is where the
project is going. It is not the better answer here: Argo Rollouts' Istio traffic
routing drives `VirtualService` weights and `DestinationRule` subsets, which is
a sidecar-era contract, and Kiali's versioned-app graph reads sidecar telemetry.
The demo is about progressive delivery, so I picked the dataplane progressive
delivery is actually wired to. [ADR 0004](../adr/0004-istio-sidecar-over-ambient.md).

**Why is the GitOps tree in the application repository?**
Because there is one team and one repository, and a separate config repo buys
you exactly one thing: the ability to give the pipeline write access to
deployments without giving it write access to source. That matters when those
are different blast radii. Here they are not. What I did keep is the discipline:
CI may only write `deploy/envs/<env>/*.yaml`, `[skip ci]` and a `paths-ignore`
allow-list stop the loop, and the AWS environment is promoted by pull request
rather than by a bot. Splitting the tree later is a `git filter-repo` and one
Application `repoURL`. [ADR 0005](../adr/0005-in-repo-gitops.md).

**Why RDS on AWS but CloudNativePG locally?**
CloudNativePG is genuinely good, and it is what runs on kind: an operator, a
`Cluster` object, generated credentials, WAL archiving to S3 if you turn it on.
On AWS I chose the boring managed thing, because a demo cluster that can lose a
spot node at any moment is the worst possible host for the only stateful thing
in the system. RDS costs 2.2 cents an hour and takes the storage, backup and
failover questions off the table. In a real platform I would ask how much
Postgres expertise the team has: CNPG if the answer is "plenty", RDS or Aurora
if it is not. [ADR 0003](../adr/0003-rds-over-cnpg.md).

**How does the rollback actually work?**
Argo Rollouts aborts and sets the `VirtualService` weights back to 100 % stable;
that is seconds and needs no human. But now the cluster is right and Git is
wrong, and the next Argo CD sync would re-apply the broken tag. So the durable
rollback is `git revert HEAD && git push`. The script prints those two lines
when it detects `Degraded`, and it deliberately does *not* offer
`kubectl argo rollouts undo`, which fixes the symptom and leaves the trap.

**What happens when a spot node is interrupted?**
AWS gives a 2-minute notice; the node is cordoned and drained, and pods are
rescheduled. Here that shows up as a blip because there are two nodes, one
replica of most things, and no PodDisruptionBudget worth the name. In production
this is where multi-AZ, a spot/on-demand mix, capacity rebalancing, Karpenter
consolidation and real PDBs live — and where I would keep the database off spot
entirely, which is exactly what RDS does.

**How do secrets get in?**
They never go through Git. External Secrets Operator holds a `ClusterSecretStore`
that points at AWS Secrets Manager on EKS, through IRSA, so the pod has an IAM
identity and not a key. Locally the same operator points at a `platform-secrets`
namespace filled from your own `.env` by a script. Same `ExternalSecret` objects,
same resulting `Secret` names, one provider swapped. Rotation is the honest gap:
Secrets Manager can rotate, ESO would re-sync, and nothing here restarts the
pods that already read the old value. [ADR 0008](../adr/0008-external-secrets-secrets-manager.md).

**How do you know mTLS is really on?**
`PeerAuthentication` is `STRICT` in the `agentflow` namespace, and
`scripts/verify-security.sh` proves it the only way that counts: it starts a pod
with no sidecar, curls the api, and expects the connection to be refused. Kiali
also draws the padlock, but a padlock in a UI is a claim, and a refused
connection is evidence.

**What does Kyverno actually block?**
Four policies: memory limit and CPU request present, no `latest` tag, non-root,
and a keyless cosign signature from this repository's workflows. The signature
policy is `Audit` locally, because kind has no guaranteed egress to Fulcio and
Rekor and side-loaded images are unsigned, and `Enforce` on AWS with
`mutateDigest: true` so what is admitted is exactly what was verified. The
non-root policy has one carve-out, written into the rule rather than as a
`PolicyException`: `istio-init` runs as uid 0 because the injector puts it
there, and no workload owner can fix that.

**Where would this fall over in production?**
Single AZ, one replica of the api because Socket.IO keeps run state in memory,
NetworkPolicies that kindnet does not enforce locally, no SLOs and no on-call,
Prometheus with 24 hours of local retention and no Thanos, and secret rotation
that nothing consumes. Those are the first six items of
[`interview-talking-points.md`](interview-talking-points.md), and the honest
answer is that this is a demo of the delivery machinery, not a production
platform.

---

Related: [`runbook-aws.md`](runbook-aws.md) for the environment,
[`security.md`](security.md) for the supply-chain detail,
[`../adr/README.md`](../adr/README.md) for every decision with its alternatives.
