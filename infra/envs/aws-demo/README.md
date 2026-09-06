# `infra/envs/aws-demo` — ephemeral EKS demo environment

Terraform stack for the AWS half of the AgentFlow showcase. It is **created and
destroyed around every demo session** (≈ 25 min up, ≈ 15 min down, ≈ 0.9 USD a
session). Nothing in here is meant to survive the night.

Terraform owns four things:

1. the network (VPC, two public subnets, two Elastic IPs),
2. the cluster (EKS control plane, one Spot Graviton node group, five add-ons),
3. the stateful bits AWS is better at than Kubernetes (RDS PostgreSQL, an S3
   bucket for Loki, three Secrets Manager entries, three IRSA roles),
4. **ArgoCD** and the single root Application `platform-root`.

Everything else — Istio, cert-manager, Argo Rollouts, Prometheus/Grafana/Loki/
Tempo, Kyverno, External Secrets, and the four AgentFlow services — is
reconciled by ArgoCD from `deploy/platform/bootstrap`. If you find yourself
adding a `kubernetes_manifest` resource here, it belongs in `deploy/` instead.

---

## Layout

| File | What it holds |
|---|---|
| `versions.tf` | `terraform >= 1.11`, `aws ~> 6.0`, `helm ~> 3.0`, `random ~> 3.6` |
| `backend.tf` | partial `backend "s3" {}` — the values come from `scripts/aws-up.sh` |
| `providers.tf` | `aws` with `default_tags`, `helm` authenticated by `aws eks get-token` |
| `variables.tf` | every input, all defaulted (`aws-up` runs `-auto-approve`) |
| `locals.tf` | `deploy/versions.yaml`, the AZ pair, the tag set, `ingress_domain` |
| `vpc.tf` | `terraform-aws-modules/vpc/aws ~> 6.0` — `10.42.0.0/16`, public only |
| `eks.tf` | `terraform-aws-modules/eks/aws ~> 21.0` — control plane, add-ons, node group |
| `irsa.tf` | the three IRSA roles, hand-written (see below) |
| `rds.tf` | `terraform-aws-modules/rds/aws ~> 6.10` + its security group |
| `secrets.tf` | `agentflow/demo/{db,rabbitmq,grafana}` and their random passwords |
| `eips.tf` | the two ingress Elastic IPs the NLB is pinned to |
| `s3.tf` | the Loki bucket, its public-access block, SSE and 7-day lifecycle |
| `argocd.tf` | `helm_release.argocd` + `helm_release.platform_root` |
| `outputs.tf` | the contract consumed by the `scripts/aws-*.sh` lifecycle |
| `.trivyignore` | the four HIGH/CRITICAL waivers, each with its reasoning |
| `terraform.tfvars.example` | the overrides worth knowing about |

### Why the IRSA roles are hand-written

`terraform-aws-modules/iam//modules/iam-role-for-service-accounts-eks` went
through a v6 rewrite that renamed nearly every input while most examples still
show the v5 names. An OIDC trust policy is twelve lines. Owning the three roles
directly keeps their least-privilege policies visible in review — which is the
entire point of the file — and removes a module that would need re-pinning at
every major bump.

---

## Prerequisites

1. **`aws configure`** (or `aws sso login`) with a principal that can create
   EKS, EC2, RDS, IAM, S3 and Secrets Manager resources. Terraform never sees a
   long-lived key in CI: `.github/workflows/aws-up.yml` assumes
   `agentflow-github-actions` through GitHub OIDC.
2. **`make aws-bootstrap` first, once.** The bootstrap stack
   (`infra/bootstrap/`, never destroyed) creates:
   - the state bucket `agentflow-tfstate-<account_id>`,
   - the 15 USD AWS Budget and its alerts,
   - the GitHub OIDC provider and the `agentflow-github-actions` role,
   - the two secrets that must outlive a session: `agentflow/demo/app` (your
     `OPENAI_API_KEY`) and `agentflow/demo/ca` (the private CA).

   Running `aws-up` before `aws-bootstrap` fails at `terraform init` with
   `NoSuchBucket`.
3. **`deploy/versions.yaml`** is the single source of truth for
   `kubernetes.eks_version` (1.34) and `argocd.chart_version`. Bump it there,
   not here.

This stack never reads or writes a credential file. The only secret material it
produces are three `random_password` values, which go straight into Secrets
Manager and into the Terraform state.

### State

`backend "s3" {}` is deliberately partial — the bucket name embeds the account
id. `scripts/aws-up.sh` supplies it:

```
terraform -chdir=infra/envs/aws-demo init -reconfigure \
  -backend-config="bucket=agentflow-tfstate-<account_id>" \
  -backend-config="key=aws-demo/terraform.tfstate" \
  -backend-config="region=eu-west-1" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"
```

`use_lockfile=true` is the native S3 lock (Terraform ≥ 1.11): no DynamoDB table
to create, pay for or forget to delete.

CI validates without credentials with `terraform init -backend=false`, which
skips the block entirely.

---

## Cost

eu-west-1, on-demand list prices for the fixed parts, spot for the nodes
(figures from Annexe G; re-measure in Cost Explorer the day after a session and
record the real numbers in `docs/ops/cost.md`).

| Item | Rate |
|---|---|
| EKS control plane | 0.100 USD/h |
| 2 × `t4g.large` Spot | 0.056 USD/h |
| 2 × public IPv4 (EIP, in use) | 0.010 USD/h |
| Node public IPv4 | 0.010 USD/h |
| NLB (in-tree, 1 LCU) | 0.031 USD/h |
| EBS 2 × 30 GiB gp3 + PVCs | 0.007 USD/h |
| RDS `db.t4g.micro` + 20 GiB gp3 | 0.022 USD/h |
| **Total** | **≈ 0.24 USD/h** |

- ≈ **0.9 USD** per 3.6 h session.
- ≈ **4.5 USD/month** for four sessions.
- Plus ≈ 0.8 USD/month of bootstrap leftovers (five Secrets Manager entries at
  0.40 USD each, S3 state, negligible S3 storage).
- Budget: **15 USD** with alerts at 50 / 80 / 100 %.

Things that would quietly blow this up and are therefore switched off: a NAT
gateway (0.045 USD/h + 0.045 USD/GB), a KMS CMK for EKS secrets and for the
buckets (1 USD/month each), CloudWatch control-plane logs and RDS Performance
Insights (ingestion + retention), a Route53 hosted zone (0.50 USD/month —
`sslip.io` instead), Multi-AZ RDS (×2), and EKS **extended support**, which
multiplies the control plane by six (0.10 → 0.60 USD/h) the moment the pinned
minor goes end-of-standard-support. `upgrade_policy.support_type = "STANDARD"`
makes the cluster refuse to enter extended support instead of silently billing
for it.

---

## Spot capacity fallback

`capacity_type = "SPOT"` is the default and saves roughly 0.13 USD/h. Three
Graviton families (`t4g.large`, `m6g.large`, `m7g.large`) are offered to the
allocator to keep the odds of a capacity error low, but eu-west-1 does run dry.

If `aws-up` fails with `InsufficientInstanceCapacity`, `UnfulfillableCapacity`
or "no Spot capacity available":

```
CAPACITY_TYPE=ON_DEMAND make aws-up      # WP13 passes it through
# or
terraform -chdir=infra/envs/aws-demo apply -var 'capacity_type=ON_DEMAND'
```

Changing `capacity_type` replaces the node group in place; the control plane,
the EIPs, the database and therefore the demo domain all survive.

A **spot interruption mid-demo** (two minutes' notice) drains one of the two
nodes. Every workload has a PDB and the platform fits on one node, so the demo
degrades rather than dies. Mention it before it happens; it is a better talking
point than an awkward silence.

---

## Known traps

**One EIP allocation per subnet, or the NLB never gets an address.**
The in-tree AWS cloud provider requires the count in
`service.beta.kubernetes.io/aws-load-balancer-eip-allocations` to match the
number of subnets the NLB is placed in, in the same order. Two public subnets →
`aws_eip.ingress` has `count = 2`. Get it wrong and the Service sits at
`EXTERNAL-IP: <pending>` forever, with no useful event. If you ever add a third
AZ, bump the count too.

**The demo domain is derived from EIP #0.**
`local.ingress_domain` is `<eip0-with-dashes>.sslip.io`, computed *before*
ArgoCD is installed and handed to the platform as `global.domain`. The EIPs are
allocated by Terraform (not by the load-balancer controller) precisely so the
domain is known at that moment. A new EIP means a new domain and a new
certificate, so `aws-down` releases both and `aws-up` allocates two fresh ones —
the URLs change between sessions. That is expected.

**An unassociated EIP is a silent 0.005 USD/h.**
`scripts/aws-check-clean.sh` fails if either survives a teardown. Do not skip it.

**`terraform destroy` blocks on load balancers and volumes.**
The NLB and the PVC-backed EBS volumes are created by Kubernetes, not by
Terraform, so Terraform does not know to delete them first and the VPC destroy
hangs on dependent ENIs. `scripts/aws-down.sh` handles the ordering: delete the
ArgoCD Applications, then the LoadBalancer Services and PVCs, wait for AWS to
catch up, and only then `terraform destroy`.

**`recovery_window_in_days = 0` on every secret.**
With the 30-day default, a `destroy` followed by an `apply` the next day fails
with *"a secret with this name is already scheduled for deletion"* and the whole
up/down/up cycle breaks.

**metrics-server is installed twice unless the catalogue is told otherwise.**
This stack enables the EKS managed `metrics-server` add-on, because on EKS it is
the maintained option and needs none of the `--kubelet-insecure-tls` workaround
kind requires. The platform catalogue also ships metrics-server as a Helm chart
at wave 1. `deploy/platform/bootstrap/values-aws.yaml` therefore has to carry:

```yaml
componentOverrides:
  metrics-server:
    enabled: false
```

Without it the `metrics-server` Application never leaves `OutOfSync`.

**Public subnets, public API endpoint, unrestricted node egress.**
All three are deliberate and all three are waived in `.trivyignore` with the
reasoning. They exist because a NAT gateway costs more than the rest of the
stack combined and there is no VPN or bastion. The honest interview answer is in
`docs/adr/0002-*` and `docs/ops/interview-talking-points.md`: in production the
nodes go in private subnets behind a NAT (or VPC endpoints), the API endpoint is
private plus an allow-list, and egress is restricted to the endpoints that are
actually needed. Narrow the endpoint today with
`api_allowed_cidrs = ["<your ip>/32"]`.

---

## Output contract

`scripts/aws-up.sh`, `aws-render-env.sh`, `aws-down.sh`, `aws-ui.sh` and
`aws-check-clean.sh` read these through `terraform output -json`. **Renaming one
breaks the lifecycle. Treat them as an API.**

| Output | Type | Consumed by |
|---|---|---|
| `region` | string | every `aws` CLI call in the scripts |
| `account_id` | string | state bucket name, Secrets Manager ARNs in the ESO overlay |
| `cluster_name` | string | `aws eks update-kubeconfig`, `aws-check-clean.sh` |
| `cluster_endpoint` | string | connectivity preflight |
| `kubeconfig_command` | string | printed by `aws-up.sh`, pasted in the runbook |
| `ingress_ips` | list(string) | the `curl` smoke test, `aws-trust-ca.sh` |
| `ingress_domain` | string | `global.domain`; the demo URLs |
| `ingress_eip_allocation_ids` | list(string) | replaces `PLACEHOLDER_EIP_ALLOCATIONS` in `deploy/platform/istio/gateway/values-aws.yaml` |
| `public_subnet_ids` | list(string) | replaces `PLACEHOLDER_PUBLIC_SUBNETS` in the same file |
| `urls` | map(string) | `api` / `studio` / `dashboard`, printed at the end of `aws-up` |
| `rds_endpoint` | string | troubleshooting only (no password) |
| `eso_role_arn` | string | replaces `PLACEHOLDER_ESO_ROLE_ARN` in `deploy/platform/external-secrets/values-aws.yaml` |
| `loki_role_arn` | string | the `eks.amazonaws.com/role-arn` annotation in `deploy/platform/loki/values-aws.yaml` |
| `loki_bucket` | string | `loki.storage.bucketNames` in the same file |
| `ebs_csi_role_arn` | string | troubleshooting only (already wired into the add-on) |
| `node_group_name` | string | `aws eks describe-nodegroup` in the runbook |
| `db_secret_arn` | string | `aws secretsmanager get-secret-value` in the runbook |
| `rabbitmq_secret_arn` | string | idem |
| `grafana_secret_arn` | string | `make aws-ui` prints the Grafana admin password |

The three secrets this stack **owns** (values generated here, `recovery_window_in_days = 0`):

| Secret | JSON keys |
|---|---|
| `agentflow/demo/db` | `username`, `password`, `host`, `port`, `dbname`, `url` (`postgres://…?sslmode=require`) |
| `agentflow/demo/rabbitmq` | `username`, `password`, `url` (`amqp://…@agentflow-rabbitmq:5672//`) |
| `agentflow/demo/grafana` | `admin-user`, `admin-password` |

`agentflow/demo/app` and `agentflow/demo/ca` belong to the **bootstrap** stack
and must not be created here — they have to survive a teardown.

---

## Verifying without AWS credentials

```
terraform -chdir=infra/envs/aws-demo init -backend=false
terraform -chdir=infra/envs/aws-demo validate
terraform fmt -check -recursive infra/envs/aws-demo

trivy config infra/envs/aws-demo --severity HIGH,CRITICAL \
  --ignorefile infra/envs/aws-demo/.trivyignore \
  --skip-dirs '**/.terraform/**'
```

Without `--ignorefile` the scan reports exactly four findings (AVD-AWS-0039,
-0040, -0041, -0104), all documented in `.trivyignore`, plus whatever the
upstream EKS module ships under `.terraform/modules/eks/examples/` — hence
`--skip-dirs`.

The provider lock covers both the Mac used to run the demo and the Linux runner
used by CI:

```
terraform -chdir=infra/envs/aws-demo providers lock \
  -platform=darwin_arm64 -platform=linux_amd64
```

`terraform plan` needs real credentials and is the user's job (Phase 4).
