# 0001 — GHCR rather than ECR

## Status

Accepted, 2026-09-06.

## Context

Four services (`api`, `worker`, `studio`, `dashboard`) need a container registry
reachable from two very different places: a kind cluster on an arm64 laptop and
an EKS node group of arm64 Graviton spot instances. Constraints:

- The AWS environment is created and destroyed several times a week. A registry
  that lives inside it would be rebuilt (and re-pulled from scratch) every time.
- The AWS budget is 15 USD/month and the target session cost is ~1 USD.
- Images must be **multi-arch**: `linux/amd64` for CI runners and anyone on an
  Intel machine, `linux/arm64` for the laptop and for Graviton.
- The build happens in GitHub Actions, which for a public repository gets free
  `ubuntu-24.04` **and** `ubuntu-24.04-arm` runners — native builds on both
  architectures, no QEMU.

## Decision

Publish to **GHCR**: `ghcr.io/billkarkariy/agentflow-{api,worker,dashboard,studio}`,
public packages, multi-arch manifest lists.

- `build-images.yml` builds each service on its native runner, pushes **by
  digest**, and the `merge` job assembles the manifest list with
  `docker buildx imagetools create`.
- Authentication in CI is the automatic `GITHUB_TOKEN` with `packages: write`.
  There is no registry credential to store or rotate.
- Because the packages are public, neither cluster needs an `imagePullSecret`.
- Tags are `sha-<7>` (what GitOps pins), `main`, and `latest` on the default
  branch.

## Consequences

**Positive**

- Zero registry cost, zero registry infrastructure, nothing to destroy.
- The same image reference works from kind, from EKS, and from a colleague's
  laptop — one `pullPolicy: IfNotPresent` and no environment-specific rewriting.
- No `imagePullSecret` means one fewer secret in the cluster and one fewer thing
  for External Secrets to project.
- Signing, SBOM attestation and Trivy SARIF all live in the same workflow as the
  push, so the artifact and its provenance never diverge.

**Negative**

- **Public images.** Anyone can pull them. Acceptable for a public showcase
  repository, unacceptable for anything proprietary.
- The four packages must be flipped to public **by hand** in the GitHub UI after
  the first build. It is a one-time manual step, and it is the single most
  common cause of `ImagePullBackOff` on a fresh clone.
- No VPC endpoint. Pulls from EKS go out over the internet, which on this
  architecture means through the nodes' public IPs. On a private-subnet cluster
  that would mean a NAT gateway and per-GB data processing.
- GHCR is a GitHub dependency. If GitHub is down, nothing deploys.
- No lifecycle policy: untagged digests accumulate. GHCR has no ECR-style
  expiry rule, so cleanup is a scheduled workflow someone has to write.

## Alternatives considered

**Amazon ECR** — the obvious AWS-native choice, with VPC endpoints, IAM-based
pulls, lifecycle policies and image scanning. Rejected because the registry
would either live inside the ephemeral stack (destroyed and repopulated every
session, adding minutes and transfer cost to every `make aws-up`) or in the
permanent bootstrap stack (storage billed forever for a demo). It also needs an
`ecr:GetAuthorizationToken` dance in CI and an IRSA-shaped pull path in the
cluster: real work that teaches the reader nothing about progressive delivery.

**ECR Public** — free-ish and pullable without credentials, but only in
`us-east-1`, with a different API and a different `docker login`. Two registries
to reason about for no benefit here.

**Docker Hub** — rate limits on anonymous pulls, which is exactly the pull
pattern this uses.

**No registry, `kind load` only** — works locally, and `make local-images` does
exactly that as a fallback. It cannot demonstrate a supply chain: no digest, no
signature, no scan, no promotion.

## In production I would

Use **ECR**, private, one repository per service, in the same account and region
as the cluster.

- **VPC endpoints** for `ecr.api`, `ecr.dkr` and the S3 gateway endpoint, so
  image pulls never leave the VPC and never touch a NAT gateway.
- **Lifecycle policies**: keep the last 30 tagged images, expire untagged after
  1 day.
- **Pull-through cache** rules for upstream registries, so a Docker Hub outage
  or rate limit is not an incident.
- **Enhanced scanning** (Inspector) for continuous re-scanning, because a CVE
  published tomorrow is not caught by a build that passed today.
- **Cross-account replication** to a shared artifact account, with the
  production cluster only permitted to pull from there — so "what is running"
  and "what CI can push" are different blast radii.
- Keep the multi-arch build and the keyless signing exactly as they are; those
  are independent of the registry.
