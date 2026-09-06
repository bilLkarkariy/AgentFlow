# Cost

The AWS environment exists to be created for a demo and destroyed the same
hour. Everything below is built around that: **about 0.24 USD per hour while it
runs, about 0.80 USD per month while it does not.**

The local kind cluster costs nothing at all, which is why it carries most of the
demo.

> These are `eu-west-1` list prices, computed rather than measured. Replace them
> with real Cost Explorer figures after the first session; AWS bills a day
> behind, so look the following morning.

---

## 1. While `make aws-up` is running

| Resource | Shape | USD / hour |
|---|---|---|
| EKS control plane | one cluster, standard support | 0.100 |
| Compute | 2 x `t4g.large` **spot**, single AZ | 0.056 |
| Public IPv4 | 2 EIPs + 2 node public IPs, 0.005 each | 0.020 |
| Network Load Balancer | 1 NLB, in-tree provider | 0.031 |
| EBS | 2 x 20 GiB gp3 node volumes + PVCs | 0.007 |
| RDS PostgreSQL | `db.t4g.micro`, single AZ, 20 GiB gp3 | 0.022 |
| **Total** | | **≈ 0.236** |

| Session length | Cost |
|---|---|
| 1 hour | ≈ 0.24 USD |
| 3.6 hours (create, demo, destroy, with slack) | ≈ 0.85 USD |
| A forgotten cluster, 24 hours | ≈ 5.70 USD |
| A forgotten cluster, 30 days | ≈ 170 USD |

That last row is why `aws-guard.yml` runs every 6 hours and why the budget is
15 USD, not 100.

**Four demos a month: ≈ 3.4 USD, plus ≈ 0.8 USD of standing cost, so under
5 USD.**

### Where the savings come from

| Decision | Saves | Cost |
|---|---|---|
| No NAT gateway, nodes in public subnets | ~0.05 USD/h **plus** all egress data processing — more than the compute | nodes have public IPs; the API server endpoint is public. Not a production shape. See [ADR 0002](../adr/0002-eks-spot-graviton-public-no-nat.md) |
| Spot instead of on-demand | ~0.13 USD/h (about 70 %) | a node can vanish with 2 minutes' notice |
| Graviton (`t4g`) instead of x86 | ~20 % | images must be multi-arch, which they are |
| Single AZ | one NAT/AZ's worth of cross-AZ traffic, and one fewer node | no availability story at all |
| `sslip.io` + private CA | Route 53 hosted zone 0.50 USD/month, ACM validation, a domain name | a browser warning until `make aws-trust-ca` |
| S3 native lockfile | a DynamoDB table | needs Terraform ≥ 1.11 |
| GHCR instead of ECR | ECR storage and data transfer | GHCR packages must be public |
| Logs, Performance Insights, enhanced monitoring all off | a few cents an hour and a lot of CloudWatch | less to look at when something breaks |

`CAPACITY_TYPE=ON_DEMAND` is the fallback when spot has no capacity. It roughly
doubles the hourly cost, to ≈ 0.37 USD/h. Still cheap; just do not leave it on.

---

## 2. While nothing is running

`infra/bootstrap` is never destroyed. It is what makes `make aws-up` a single
command rather than a checklist.

| Resource | USD / month |
|---|---|
| Secrets Manager, `agentflow/demo/app` and `agentflow/demo/ca` | 0.80 |
| S3 `agentflow-tfstate-<account>`, a few hundred KB versioned | < 0.01 |
| S3 Loki bucket, emptied by `aws-down` | < 0.01 |
| Budget, anomaly monitor, OIDC provider, IAM roles | 0.00 |
| **Total** | **≈ 0.80** |

The secrets created by the *demo* stack (`agentflow/demo/db`,
`agentflow/demo/rabbitmq`, `agentflow/demo/grafana`) use
`recovery_window_in_days = 0`, so they are gone the moment `aws-down` finishes
and they never appear on this table.

---

## 3. What keeps billing if teardown was incomplete

`make aws-check-clean` exists for exactly this list. In descending order of how
easy each is to miss:

| Leftover | Cost | Why it survives |
|---|---|---|
| **Unassociated Elastic IP** | 0.005 USD/h each, forever | attached to nothing, so nothing complains |
| **Orphan EBS volume** | 0.088 USD/GiB/month | a PVC deleted after its node, or `Retain` reclaim policy |
| **Network Load Balancer** | 0.031 USD/h + LCU | created by Kubernetes, not by Terraform: `terraform destroy` does not know about it |
| **EKS cluster** | 0.10 USD/h | a failed destroy that was not retried |
| **RDS instance** | 0.022 USD/h + storage | `deletion_protection` is `false` here, so this only happens after a failed destroy |
| RDS snapshot | storage only | `skip_final_snapshot` is `true`, so there should be none |
| CloudWatch log group | pennies | `/aws/eks/...` groups outlive the cluster |
| Secret pending deletion | 0.40 USD/month each | only if something created one with a recovery window |

```sh
make aws-down
make aws-check-clean          # exits 1 if any of the above is still there
make aws-cost                 # what this session has cost so far
```

And the day after, the authoritative answer:

```sh
aws ce get-cost-and-usage --time-period Start=2026-01-01,End=2026-01-02 \
  --granularity DAILY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

---

## 4. Guardrails

| Guardrail | Where | What it does |
|---|---|---|
| Budget, 15 USD/month | `infra/bootstrap` | email at 50 %, 80 %, 100 % of forecast |
| Cost anomaly monitor | `infra/bootstrap` | flags an unusual daily spike, which is what a forgotten cluster looks like |
| `aws-guard.yml` | 6-hour cron | fails the run if a cluster, load balancer or RDS instance exists; `auto_destroy` input can tear it down |
| `make aws-check-clean` | on demand | non-zero exit while anything survives |
| `make aws-cost` | on demand | session duration from `~/.agentflow/session` x the hourly rate |
| Everything tagged `Project=agentflow, Env=demo` | all stacks | Cost Explorer can be grouped by tag, and the sweep can find leftovers |

**Confirm the budget email.** AWS Budgets sends a subscription confirmation; an
unconfirmed address means the alerts fire into nothing.

---

## 5. Free tier

Do not plan around it.

- **EKS has no free tier.** The control plane is 0.10 USD/h from the first
  minute.
- **RDS**: legacy accounts get 750 hours/month of a `db.t4g.micro` for the first
  12 months, which would make the database free here. Accounts created under the
  newer free plans get a credit allowance instead. Check
  `aws freetier get-free-tier-usage` rather than assuming.
- **NLB and public IPv4** are billed from the first hour in every account.
- **Data transfer out** is negligible at demo volumes and is not modelled above.

If the account is on a credit-based free plan, the whole thing may show as
0.00 USD until the credit runs out. That is a discount, not a different
architecture: the numbers above are still what it costs.

---

Back to [`README.md`](README.md), or on to
[`interview-talking-points.md`](interview-talking-points.md), where "what would
change in production" is mostly a list of things that cost more.
