# What would change for real production

This platform is a demo of delivery machinery, sized for one laptop and a 15 USD
budget. Every shortcut below was taken on purpose; each line names the concrete
object I would add instead.

Use it two ways: as the script for the "so what's missing?" question, and as the
honest backlog if this ever carried traffic.

---

## Availability and capacity

| Today | In production | The concrete change |
|---|---|---|
| Single AZ, single node group | Three AZs | `subnet_ids` across 3 AZs, one node group per AZ, `topologySpreadConstraints` with `topologyKey: topology.kubernetes.io/zone` on every workload |
| 2 fixed spot nodes | Demand-driven capacity | **Karpenter** `NodePool` + `EC2NodeClass`, spot with `consolidationPolicy: WhenEmptyOrUnderutilized`, on-demand fallback for the `system` pool |
| Spot everywhere | Spot for stateless only | `karpenter.sh/capacity-type` taint, on-demand node pool for anything that holds state or is on the request path alone; AWS Node Termination Handler is built into Karpenter |
| `pdb.minAvailable: 1`, one api replica | Real disruption budgets | `replicaCount >= 3` per service, `minAvailable: 50%`, and move Socket.IO state out of process (the Redis adapter) so replicas stop being a lie |
| No cluster autoscaling story | HPA on the right signal | KEDA scaling the worker on RabbitMQ queue depth rather than CPU; HPA on latency via the Prometheus adapter for the api |
| `metrics-server` only | Right-sizing | VPA in `Off` (recommender) mode, then act on the recommendations quarterly |

---

## Network

| Today | In production | The concrete change |
|---|---|---|
| Nodes in public subnets, no NAT | Private subnets | private subnets + NAT gateway per AZ, or better: **VPC endpoints** for S3 (gateway), ECR, STS, Secrets Manager, EKS and CloudWatch, so most egress never touches a NAT |
| Public EKS API endpoint, `0.0.0.0/0` | Private endpoint | `endpoint_public_access = false`, access through a VPN or an SSM bastion; if it must stay public, `api_allowed_cidrs` narrowed to the office range |
| NLB with the in-tree provider | AWS Load Balancer Controller | the controller add-on with IRSA, `TargetGroupBinding` and IP-target mode, so pods are targets and node draining stops dropping connections |
| `sslip.io` + private CA | Real DNS and real certificates | Route 53 hosted zone, **ACM** certificate on the NLB or **cert-manager + Let's Encrypt DNS-01** with `external-dns` writing records |
| NetworkPolicies not enforced locally | Enforced everywhere | Cilium (or Calico) on the local cluster, `enableNetworkPolicy: true` on the VPC CNI add-on, plus a policy test in CI |
| mTLS STRICT, no authorization | Identity-based authorization | Istio `AuthorizationPolicy` per workload: only `istio-ingress` may call `api`, only `api` may call the database's port. mTLS says "who", `AuthorizationPolicy` says "may do what" |
| Namespace `agentflow` is `warn: restricted` | Enforced Pod Security | PSS `enforce: restricted` on every application namespace, with the exemptions written down |

---

## Data

| Today | In production | The concrete change |
|---|---|---|
| RDS single AZ, `db.t4g.micro` | Multi-AZ | `multi_az = true`, or **Aurora PostgreSQL** with a reader in each AZ once the read load justifies it |
| `backup_retention_period = 1`, `skip_final_snapshot` | Real recovery objectives | 7-35 day retention, point-in-time recovery, `deletion_protection = true`, `final_snapshot_identifier`, and a **restore rehearsal in CI** — a backup nobody restores is a hope |
| One database, one role | Least privilege | separate roles for migrations and for the application; IAM database authentication so there is no long-lived password at all |
| Redis and RabbitMQ as in-cluster StatefulSets | Managed, or genuinely clustered | ElastiCache and Amazon MQ, or a proper RabbitMQ quorum-queue cluster with the operator; today they are single pods with a PVC |
| No DR | A stated RPO/RTO | cross-region automated backup replication for RDS, Terraform that can rebuild the environment in a second region, and a documented decision about how much data loss is acceptable |
| Migrations as a PreSync Job | Same, plus a rule | expand/contract migrations only, so a rollback of the application never needs a rollback of the schema; the Job stays, the discipline is the addition |

---

## Delivery and GitOps

| Today | In production | The concrete change |
|---|---|---|
| GitOps tree inside the app repository | Separate config repository | `agentflow-deploy`, so the pipeline's write token cannot touch source; Applications point at its `repoURL`. This is a `git filter-repo` and one field |
| CI writes `deploy/envs/local` directly | Promotion is always a PR | the AWS flow already is; make local the same, with an auto-merge rule for green builds |
| One environment per cluster | Environments as a matrix | Argo CD `ApplicationSet` with a cluster generator, `dev`/`staging`/`prod` as clusters rather than as directories |
| Canary on the api only | Canary everywhere it means something | the studio and dashboard already use `Rollout`; add analysis to them once there is a metric worth aborting on, and add `AnalysisTemplate`s for business metrics, not only HTTP |
| Analysis on success rate and p95 | Analysis on the SLO | error budget burn rate as the abort condition, so the gate matches the promise made to users |
| Manual `make demo-*` | Automated verification | a smoke-test `AnalysisTemplate` with a `Job` provider running the k6 script against the canary before any traffic shift |

---

## Observability and operations

| Today | In production | The concrete change |
|---|---|---|
| Prometheus, 24 h local retention | Durable, global metrics | **Thanos** (sidecar + store gateway + compactor) or **Grafana Mimir**, both backed by S3; or Amazon Managed Prometheus if the team would rather not run it |
| Loki single binary, filesystem locally | Loki in microservices mode | S3 backend, retention by tenant, and a log budget — logs are the line item that surprises people |
| Tempo monolithic, 24 h | Sampled and retained | tail-based sampling in the collector so errors are always kept, S3 backend, and a retention that matches the incident review window |
| Alerts go to a `null` receiver | Real routing | Alertmanager to PagerDuty/Opsgenie with severity routing, and an on-call rota that owns them |
| Seven `PrometheusRule` alerts on symptoms | SLOs first | availability and latency SLOs per service, multi-window multi-burn-rate alerts (Sloth or Pyrra to generate them), and everything else demoted to a dashboard |
| No runbook links in alerts | Every alert links to its fix | `runbook_url` annotation on each rule, pointing into `docs/ops/` |
| Nothing tracks change failure rate | DORA metrics | derive them from the deployment commits in `deploy/envs/**` and the AnalysisRun outcomes; the data is already there |

---

## Security and compliance

| Today | In production | The concrete change |
|---|---|---|
| Cosign verification `Enforce` on AWS, `Audit` locally | Enforce everywhere | a Rekor mirror or an air-gapped verification story, so the local cluster can enforce too |
| SBOM attested, nothing consumes it | Attestations that gate | SLSA provenance verified by a Kyverno `verifyImages.attestations` rule, so "built by this workflow from this commit" is an admission requirement, not a label |
| Trivy on images only | The whole surface | Trivy config scanning on `deploy/**` and `infra/**` in CI (already in `terraform-ci.yml`), plus continuous re-scanning of running images, because a CVE published tomorrow is not caught by a build that passed today |
| IRSA roles per component | Least privilege, checked | one role per service account with resource-scoped policies, IAM Access Analyzer on the account, and **EKS Pod Identity** instead of IRSA for new roles — same idea, less OIDC plumbing |
| `enable_cluster_creator_admin_permissions` | Named access entries | `access_entries` mapping real IAM roles to `AmazonEKSClusterAdminPolicy` / `ViewPolicy`, no implicit creator admin |
| Secrets stored, never rotated | Rotation that lands | Secrets Manager rotation Lambda for the database credential, `refreshInterval` on the `ExternalSecret`, and **Reloader** to restart the pods that read it — rotation nothing consumes is theatre |
| No audit trail beyond `git log` | Audit | EKS control-plane audit logs to CloudWatch, CloudTrail with a multi-region trail into a locked S3 bucket, and GuardDuty EKS Protection |
| Kyverno reports off (memory) | Reports on | `reports` and `cleanup` controllers enabled, `PolicyReport` surfaced in a dashboard, so drift is visible and not only blocked at admission |
| Etcd encryption off | KMS everywhere | EKS secrets encryption with a customer-managed KMS key, EBS and RDS encrypted with CMKs, S3 with SSE-KMS |

---

## Cost and governance

| Today | In production | The concrete change |
|---|---|---|
| Ephemeral cluster, destroyed after each demo | Long-lived clusters | **Compute Savings Plans** or reserved instances for the steady-state floor, spot only for the elastic part |
| One 15 USD budget | Cost per team | tag-based cost allocation, budgets per environment, and **Kubecost** or OpenCost for per-namespace attribution |
| Manual `make aws-up` / `aws-down` | Scheduled environments | non-production clusters scaled to zero out of hours by a scheduled workflow; the `aws-guard.yml` cron is the toy version of exactly this |
| Chart versions pinned by hand | Automated, tested bumps | Renovate/Dependabot on the Helm pins, `make lint-deploy` as the required check, and a staging cluster that gets them first |
| EKS version bumped when convenient | A cadence | one minor per quarter, always inside standard support (extended support is 6x the control-plane price), node groups upgraded before the control plane's grace period expires |
| No policy on what may be deployed | Governance as code | Kyverno policies for required labels, allowed registries and mandatory `runbook_url`; the four here are the starter set, not the finished one |

---

## The three I would do first

If someone handed me this platform and one sprint:

1. **Multi-AZ and real replicas.** Single AZ plus one api replica means every
   maintenance event is an outage. Three AZs, three replicas, Socket.IO state in
   Redis. Nothing else matters until this is true.
2. **SLOs and alert routing.** Seven symptom alerts firing into a `null`
   receiver is not an operations story. Two SLOs per service, burn-rate alerts,
   a rota.
3. **Backups that are restored.** RDS with PITR is easy; a scheduled restore
   into a scratch instance that CI then queries is the part people skip and the
   part that turns out to matter.

---

Related: [`security.md`](security.md) for what is in place today,
[`cost.md`](cost.md) for what each of these costs,
[`../adr/README.md`](../adr/README.md) for why the current shape was chosen.
