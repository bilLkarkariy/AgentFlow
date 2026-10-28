# 0010 — Terraform: S3 native locking, a permanent bootstrap stack, an ephemeral demo stack, GitHub OIDC

## Status

Accepted, 2026-09-06.

## Context

Three environments have to be described in Terraform, and they have very
different lifecycles:

| Stack | Lifecycle | State |
|---|---|---|
| `infra/envs/local` | created and destroyed daily, on a laptop | disposable |
| `infra/envs/aws-demo` | created and destroyed several times a week | must survive between `up` and `down` |
| the things `aws-demo` needs in order to exist | never destroyed | must survive everything |

There is a genuine chicken-and-egg problem: the S3 bucket that holds the demo
environment's state cannot itself be stored in that bucket. And a workflow that
can create an EKS cluster must not do so with a long-lived AWS access key
sitting in GitHub secrets.

## Decision

**Three stacks, three lifecycles.**

```
infra/bootstrap/     never destroyed, ~0.80 USD/month
  S3 agentflow-tfstate-<account_id>   versioned, encrypted, prevent_destroy
  aws_budgets_budget 15 USD + cost anomaly monitor
  GitHub OIDC provider + IAM role agentflow-github-actions
  Secrets Manager shells agentflow/demo/{app,ca}

infra/envs/aws-demo/ created and destroyed per session
  VPC, EKS, node group, RDS, EIPs, IRSA roles, helm_release.argocd

infra/envs/local/    kind + Argo CD, local state, gitignored
```

**State**: `backend "s3" {}` — deliberately partial. The bucket, key and region
come from `-backend-config` flags that `scripts/aws-up.sh` derives from the
bootstrap outputs, so the repository contains no account id.
`use_lockfile = true` uses S3's **native conditional-write locking**
(Terraform ≥ 1.11), so there is no DynamoDB table to create, pay for or forget
to destroy. Keys are `bootstrap/terraform.tfstate` and
`aws-demo/terraform.tfstate` in the same bucket.

**Local state stays local.** `infra/envs/local` writes a `terraform.tfstate` next
to itself, gitignored. The cluster is a container; if the state is lost, the fix
is `kind delete cluster`.

**Terraform's job stops at the cluster.** In both AWS and kind, it creates the
cluster, installs Argo CD with `helm_release`, and injects **one** object — the
`platform-root` `Application` — through the chart's `extraObjects`. Everything
else is Argo CD's. There is exactly one `helm_release` in each stack.

**CI authenticates with OIDC.** `aws-up.yml`, `aws-down.yml` and `aws-guard.yml`
run on the GitHub environment `aws-demo` (required reviewer) and assume
`agentflow-github-actions` through
`aws-actions/configure-aws-credentials`. The role's trust policy is pinned to
`repo:bilLkarkariy/AgentFlow:environment:aws-demo`, so a workflow on a fork or
on an unreviewed branch cannot assume it.

## Consequences

**Positive**

- **`make aws-up` is one command** with no prerequisites beyond `aws configure`,
  because everything it needs already exists in the bootstrap stack.
- **No long-lived AWS credential anywhere**: not in the repository, not in
  GitHub secrets, not in the cluster. OIDC for CI, IRSA for workloads.
- No DynamoDB lock table means one fewer resource, one fewer cost, and one fewer
  thing left behind by a failed destroy.
- `prevent_destroy` on the state bucket makes "destroyed the bucket holding my
  state" impossible by accident.
- The budget and the anomaly monitor live in the stack that is never destroyed,
  so the guardrails cannot be torn down with the thing they guard.
- **Small blast radius.** Because Terraform only creates the cluster and Argo CD,
  `terraform destroy` has very little to unwind and `terraform plan` on a running
  environment is short and readable.
- Terraform and the platform catalogue read the same `deploy/versions.yaml`
  (`yamldecode`), so the kind node image, the EKS version and the Argo CD chart
  version have one source of truth.

**Negative**

- **Three stacks means three `terraform init`s** and a mental model that has to
  be explained. The bootstrap stack in particular is invisible until it is
  missing.
- The bootstrap stack costs ~0.80 USD/month **forever**, mostly Secrets Manager.
  Small, but it is the price of "one command".
- `use_lockfile` needs Terraform ≥ 1.11 (or a recent OpenTofu). Anyone on an
  older version gets a confusing error rather than a clear one.
- **`helm_release.argocd` is the awkward resource.** It lives in Terraform state
  but its cluster is destroyed by the same apply, so a failed destroy can leave
  it stuck. `aws-down` has an explicit `terraform state rm helm_release.argocd`
  recovery path, which is a workaround, not a design.
- Local state means `make local-up` from two checkouts is two clusters, and
  there is no locking. Correct for a laptop, surprising once.
- Terraform does not know about the load balancers and EBS volumes Kubernetes
  creates, which is why `aws-down` has to delete them *before* `terraform
  destroy` and wait for AWS to finish. That ordering is the single most
  operationally important thing in the whole teardown.

## Alternatives considered

**DynamoDB lock table** — the classic pairing with an S3 backend. Rejected
because native S3 locking removes a resource, a cost and a teardown liability,
and because there is exactly one person and one CI job touching this state.

**Terraform Cloud / HCP Terraform** — free for small teams, remote state, remote
runs, and it would solve the chicken-and-egg problem outright. Rejected because
it moves the interesting part (how do you bootstrap state? how does CI
authenticate?) off-platform, and this repository exists to show that part.

**One stack for everything** — simplest to explain, and wrong: the budget, the
state bucket and the OIDC role must outlive the cluster, and a single stack
would either destroy them with it or need `prevent_destroy` on half its
resources.

**Local state committed to Git for the demo stack** — no. State contains
resource identifiers and, depending on the provider, sensitive values; a public
repository is the worst place for it. `*.tfstate` is gitignored and always will
be.

**Terraform managing the whole platform** (Helm releases for Istio, Prometheus,
Kyverno…) — the obvious alternative to Argo CD, and it would work. Rejected
because it makes `terraform apply` the deployment mechanism, which means a
20-minute plan, a lock held for the duration, drift that is only visible when
someone runs `plan`, and no reconciliation loop. The whole argument of this
repository is that the cluster should converge on Git continuously, not when a
human runs a command.

**Crossplane** — Kubernetes-native infrastructure, and it would let Argo CD own
the AWS resources too. Genuinely interesting, and rejected as one abstraction
too many for a demo: the chicken-and-egg problem simply moves (who creates the
cluster that runs Crossplane?) and Terraform is what the target roles ask
about.

**Long-lived IAM access keys in GitHub secrets** — the thing OIDC exists to
replace. Not seriously considered.

## In production I would

- **One state bucket per account**, with a key per stack and per environment,
  MFA-delete on the bucket, and access logging.
- **Terraform Cloud, Spacelift or Atlantis** for plan/apply as a reviewed
  pull-request workflow — `terraform plan` output as a PR comment, apply only
  after approval, and a real audit trail of who applied what.
- **Separate AWS accounts** per environment (`dev`, `staging`, `prod`, plus a
  shared services account for artifacts), wired with Control Tower or Organizations,
  so a mistake in one cannot reach another. The OIDC role would be assumed
  per-account with an environment-scoped trust condition, as it already is here.
- **Narrow the CI role.** `agentflow-github-actions` currently needs enough to
  create an EKS cluster, which is a lot. In production the CI identity should be
  able to apply a plan, not to invent one: a permissions boundary, plus
  IAM Access Analyzer on the account.
- **`prevent_destroy` and `deletion_protection` on everything stateful**, and a
  `terraform plan` diff review that a human actually reads before a production
  apply.
- **Drift detection on a schedule** (`terraform plan -detailed-exitcode` in a
  cron workflow) — the equivalent of what `aws-guard.yml` does for cost, applied
  to configuration.
- Keep `deploy/versions.yaml` as the shared source of truth, keep Terraform's
  job limited to "cluster + GitOps agent", and keep the teardown ordering. Those
  three survive the move to production unchanged.
