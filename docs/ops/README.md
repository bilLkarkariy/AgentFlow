# AgentFlow operations

Everything about running this platform: how it is built, how to bring it up on a
laptop or on AWS, what it costs, how the demo goes, and what would change if it
were real.

---

## The 30-second version

Two environments, one `deploy/` tree, one chart per shape.

|  | **local** | **aws** |
|---|---|---|
| Cluster | kind, `agentflow-local` | EKS `agentflow-demo`, `eu-west-1` |
| Created by | `make local-up` (~15 min) | `make aws-up` (~25 min) |
| Cost | free | ≈ 0.24 USD/hour, destroyed after the demo |
| Domain | `*.127.0.0.1.sslip.io` | `*.<eip-with-dashes>.sslip.io` |
| Postgres | CloudNativePG in-cluster | RDS `db.t4g.micro` |
| Image tag | bumped automatically by CI | promoted by pull request |
| Signature policy | Kyverno `Audit` | Kyverno `Enforce` |
| Admin UIs | published through the gateway | `kubectl port-forward` (`make aws-ui`) |
| Purpose | 80 % of the demo, every day | proving it is not only a laptop trick |

What is identical: Argo CD and the whole `deploy/platform` catalogue, Istio with
mTLS STRICT, Argo Rollouts canary with Prometheus analysis, the observability
stack, Kyverno, External Secrets, and every application chart and values file.
The environment differences are a handful of `values-aws.yaml` files.

Terraform creates exactly two things — the cluster and Argo CD — and one
`Application` called `platform-root`. Argo CD installs the other twenty-odd.

---

## Three commands

```sh
make local-up                        # the whole platform on this laptop
make aws-up                          # the same thing on real EKS, then aws-down
make demo-canary TAG=sha-1a2b3c4     # deploy through the canary and watch it
```

`make help` lists everything. The rest of the day-to-day:

| Command | What it does |
|---|---|
| `make check-tools` | is this machine ready |
| `make local-wait` / `make local-status` / `make local-ui` | wait, inspect, print URLs |
| `make local-images` | build the four images locally and load them into kind |
| `make lint-deploy` | render and validate every chart, values file and manifest |
| `make demo-break` / `make demo-fix` | inject 30 % errors, watch the rollback, then heal |
| `make loadgen` / `make loadgen-k6` | steady traffic, with or without SLO thresholds |
| `make aws-status` / `make aws-ui` / `make aws-trust-ca` / `make aws-cost` | inspect and use the AWS environment |
| `make aws-down` / `make aws-check-clean` | destroy it, then prove it is gone |
| `scripts/verify-security.sh` | Kyverno, External Secrets and mTLS, end to end |
| `scripts/check-rules.sh` | `promtool` on every `PrometheusRule` |

---

## Documents

| Document | Read it when |
|---|---|
| [`architecture.md`](architecture.md) | you want the three diagrams and the contract tables |
| [`runbook-local.md`](runbook-local.md) | bringing the kind cluster up, or something is stuck |
| [`runbook-aws.md`](runbook-aws.md) | creating, using and destroying the EKS environment |
| [`cost.md`](cost.md) | before spending money, and after forgetting to tear down |
| [`demo-script.md`](demo-script.md) | the T-45 checklist, the 10-minute script, the likely questions |
| [`interview-talking-points.md`](interview-talking-points.md) | "what would change in production" |
| [`security.md`](security.md) | supply chain, runtime, network, secrets, and the honest gaps |
| [`../adr/README.md`](../adr/README.md) | why each decision was made, and what was rejected |

Adjacent, and owned elsewhere in the repository:

| Document | Covers |
|---|---|
| [`../../deploy/README.md`](../../deploy/README.md) | the GitOps tree: charts, values, Applications, `make lint-deploy` |
| [`../../infra/README.md`](../../infra/README.md) | Terraform: the kind environment, the AWS environments, the bootstrap stack |
| [`../../deploy/charts/agentflow-service/README.md`](../../deploy/charts/agentflow-service/README.md) | the golden-path chart, every value documented |
| [`../../deploy/charts/agentflow-infra/README.md`](../../deploy/charts/agentflow-infra/README.md) | Postgres, Redis and RabbitMQ in the cluster |

---

## Where things live

```
Makefile, mk/*.mk        every entry point; `make help` is the index
scripts/                 check-tools, hosts-setup, seed-local-secrets, wait-apps,
                         local-images, check-rules, verify-security,
                         demo-canary, loadgen, k6/, aws-*
infra/                   Terraform: envs/local, envs/aws-demo, bootstrap
deploy/platform/         the platform catalogue Argo CD installs, by sync wave
deploy/charts/           agentflow-service (golden path), agentflow-infra
deploy/envs/             base + local + aws values, one file per service
deploy/argocd/           the Argo CD install and the per-environment Applications
.github/workflows/       ci, build-images, deploy-validate, promote-aws,
                         terraform-ci, aws-up, aws-down, aws-guard
docs/ops/, docs/adr/     this directory, and the decisions behind it
```

---

## If you only have five minutes

Read [`architecture.md`](architecture.md) diagram 3, then run:

```sh
make local-up
make demo-break TAG=$(make -s demo-tag | awk '{print $2}')
```

and watch the AnalysisRun fail and the traffic go back. That is the whole thesis
of this repository in one command.
