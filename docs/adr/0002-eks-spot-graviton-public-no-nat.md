# 0002 — EKS with spot Graviton nodes in public subnets, single AZ, no NAT

## Status

Accepted, 2026-09-06.

## Context

The AWS environment exists to prove that the platform is not only a laptop
trick. It is created for a demo and destroyed the same hour. The binding
constraints:

- Budget: 15 USD/month, target ~1 USD per session.
- The cluster must run the full platform profile: Istio, Argo CD, Argo Rollouts,
  Prometheus, Grafana, Loki, Tempo, Kyverno, External Secrets, plus four
  application workloads with sidecars. That is roughly 8 GiB of requests.
- Every image is already built for `linux/arm64`, so Graviton is free money.
- It must come up in about 25 minutes, unattended, from one command.

The dominant cost in a naive EKS setup is not the nodes. A **NAT gateway** is
~0.045 USD/h *per AZ* plus 0.045 USD per GB processed — on a cluster that pulls
several GB of images on every creation, that is more than everything else
combined.

## Decision

| Choice | Value |
|---|---|
| Region | `eu-west-1` |
| Subnets | 2 public `/20`, `map_public_ip_on_launch`, **no private subnets, no NAT** |
| Node group | managed, `AL2023_ARM_64_STANDARD`, single AZ |
| Instance types | `["t4g.large", "m6g.large", "m7g.large"]` |
| Capacity | `SPOT`, min 2 / desired 2 / max 3 |
| Control plane | public endpoint, `authentication_mode = API`, logs off, KMS off |
| Add-ons | vpc-cni with `ENABLE_PREFIX_DELEGATION=true` (`before_compute`), coredns, kube-proxy, ebs-csi via IRSA, metrics-server |
| Ingress | in-tree NLB with 2 Elastic IPs |

Result: **≈ 0.24 USD/hour**, of which the control plane alone is 0.10.
`CAPACITY_TYPE=ON_DEMAND` is a documented one-flag fallback for the days spot
has no capacity.

## Consequences

**Positive**

- Roughly 0.24 USD/h instead of ~0.60 for the equivalent private-subnet,
  multi-AZ, on-demand shape. A 3.6-hour session costs less than a coffee.
- Graviton is ~20 % cheaper than the x86 equivalent and the images already
  support it, so the saving is free.
- Three instance families make a spot capacity error unlikely; when it happens,
  it is one flag.
- Prefix delegation raises the pods-per-node ceiling enough that two
  `t4g.large` hold the whole platform.
- No NAT gateway also means no NAT gateway to fail to destroy, which is one of
  the classic ways a teardown leaves money running.

**Negative**

- **No availability story at all.** One AZ, spot nodes: a zonal event or a spot
  reclamation is an outage, not a blip. This is the single biggest thing to
  declare out loud rather than be caught on.
- Nodes have **public IP addresses**. They are behind security groups and the
  EKS-managed rules, but they are internet-addressable, which no production
  cluster should be.
- The Kubernetes API endpoint is public and, by default, open to `0.0.0.0/0`.
  `api_allowed_cidrs` exists to narrow it and is not narrowed by default.
- Two public IPv4 addresses on the EIPs plus two on the nodes cost 0.02 USD/h,
  which is now a real line item since AWS started charging for IPv4.
- Spot interruptions during a demo are possible. The mitigation is that the
  demo is short and the database is not on a node.
- Single AZ also means the NLB has one target AZ; cross-zone load balancing is
  enabled but there is nothing to balance across.

## Alternatives considered

**Private subnets with a NAT gateway** — the correct production shape.
Rejected on cost: ~0.045 USD/h per AZ plus per-GB processing, which for an
image-heavy cluster roughly triples the bill. It would also add several minutes
to creation and teardown.

**Private subnets with VPC endpoints and no NAT** — genuinely cheaper than NAT
and the right middle ground, but it needs interface endpoints for ECR API, ECR
DKR, STS, Secrets Manager, EC2, ELB and CloudWatch at ~0.011 USD/h *each*, plus
an S3 gateway endpoint. That is ~0.08 USD/h of endpoints, more than the compute,
and it still would not reach GHCR (see [ADR 0001](0001-ghcr-over-ecr.md)).

**Fargate** — no nodes to manage and no spot interruptions, but no DaemonSets,
which kills Alloy for log collection; no privileged init containers, which
complicates the Istio sidecar injection story; and a per-pod price that works
out higher for a cluster this dense.

**k3s or kOps on plain EC2** — cheaper still, and it would avoid the 0.10 USD/h
control plane. Rejected because "I ran Kubernetes on EC2" is a different
conversation from "I ran EKS": the interesting parts here are IRSA, access
entries, managed add-ons and the AWS integration points.

**On-demand instead of spot** — about +0.13 USD/h. Kept as a fallback flag
rather than a default, because a demo that dies from a spot reclamation is worse
than a demo that costs twice as much.

**Multi-AZ** — the honest answer is that it roughly doubles the node count for a
platform that already fits in two nodes, and adds cross-AZ data transfer. For a
demo, single AZ plus a clear statement of the consequence is more useful than a
more expensive lie.

## In production I would

- **Three AZs.** Private subnets, one NAT gateway per AZ (or a shared one with
  the cross-AZ cost accepted), plus VPC endpoints for the chatty services so
  most traffic never reaches the NAT.
- **Private API endpoint**, reached through a VPN or an SSM session; if it must
  stay public, an allow-list of office and CI ranges.
- **Karpenter** rather than a fixed managed node group: a spot `NodePool` for
  stateless workloads with `consolidationPolicy: WhenEmptyOrUnderutilized`, and
  a small on-demand pool for the system components, with capacity-type taints so
  the scheduler cannot put critical pods on interruptible capacity.
- **Compute Savings Plans** for the steady-state floor, spot only for the
  elastic part above it.
- `topologySpreadConstraints` on `topology.kubernetes.io/zone` for every
  workload, real `PodDisruptionBudget`s, and at least three replicas of anything
  on the request path.
- Control-plane **audit logs** to CloudWatch, **KMS envelope encryption** for
  etcd secrets, and named `access_entries` instead of
  `enable_cluster_creator_admin_permissions`.
- One EKS minor upgrade per quarter, always inside **standard support** —
  extended support costs six times the control-plane rate, which is why
  `aws-up` checks for it in preflight before spending 25 minutes.
