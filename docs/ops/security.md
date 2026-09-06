# Security

What is actually enforced, where, and what is not. The gaps are listed because
a security section without them is marketing.

One command proves most of this:

```sh
scripts/verify-security.sh            # offline checks, then live ones
scripts/verify-security.sh --offline  # CI: kyverno test + kubeconform only
```

It runs the Kyverno policy suite, validates every overlay, then — if a cluster
answers — tries to create an offending pod, checks every `ExternalSecret` is
`SecretSynced`, and curls the api from a pod with no sidecar expecting to be
refused.

---

## Supply chain

| Control | Where | Effect |
|---|---|---|
| **Trivy** image scan | `build-images.yml`, `merge` job | `CRITICAL` with `--ignore-unfixed` fails the build; SARIF is uploaded to the Security tab |
| **Trivy** config scan | `terraform-ci.yml` | misconfigurations in `infra/**` on every PR, no credentials needed |
| **Cosign**, keyless | `build-images.yml` | signs each digest with the workflow's OIDC token, so the signature is bound to `repo:bilLkarkariy/AgentFlow` + workflow + ref, not to a key that can be copied |
| **SBOM** | `anchore/sbom-action` + `cosign attest` | SPDX document attached to the image as an attestation |
| **Kyverno `verify-image-signatures`** | `deploy/platform/kyverno/policies/base` | `Enforce` on AWS with `mutateDigest: true`, `Audit` on kind |
| **Pinned digests at admission** | same policy | `mutateDigest` rewrites the tag to the verified digest, closing the tag-swap window between the admission check and the kubelet pull |
| **No `latest`** | `disallow-latest-tag` | an unpinnable tag makes desired state unknowable and a rollback meaningless |

Why `Audit` locally: kind has no guaranteed egress to Fulcio and Rekor, and
`make local-images` side-loads unsigned images on purpose. Kyverno also refuses
`mutateDigest: true` together with an `Audit` failure action, so the overlays
patch both fields as a pair.

The gap: the SBOM is produced and attested, but nothing consumes it. Verifying
SLSA provenance as an admission requirement is the next step, not a done one.

---

## Runtime

Every workload renders from one chart, so these are not per-service choices:

```yaml
podSecurityContext:       runAsNonRoot: true, uid/gid/fsGroup 10001,
                          seccompProfile: RuntimeDefault
containerSecurityContext: allowPrivilegeEscalation: false,
                          readOnlyRootFilesystem: true,
                          capabilities: { drop: [ALL] }
serviceAccount:           automountServiceAccountToken: false
```

Read-only root filesystems mean every writable path is an explicit `emptyDir`
(`/tmp` for the api's Python scratch files, `/tmp/runtime` for the SPA's
generated `/config.js`). That is the point: an unexpected write fails loudly at
review time instead of quietly at runtime.

| Policy | Enforced | Note |
|---|---|---|
| `require-resource-limits` | memory limit + CPU request on every application container | no CPU limit on purpose: CFS throttling costs more latency than it saves |
| `require-run-as-nonroot` | all containers, and all init containers except `istio-init` | the carve-out lives in the rule, not in a `PolicyException`, because an exception's unit is the whole pod |
| Pod Security Standards | `warn: restricted` on `agentflow` | warn, not enforce, because `istio-init` needs `NET_ADMIN`/`NET_RAW` without `istio-cni` |

---

## Network

| Layer | Control | Enforced where |
|---|---|---|
| L7 identity | Istio `PeerAuthentication` **STRICT** in `agentflow` | everywhere. A pod without a sidecar cannot call the api, and `verify-security.sh` proves it |
| L3/L4 | `NetworkPolicy`: default deny, then DNS, istiod 15012, the ingress gateway, intra-namespace, kube-apiserver, observability scrape ports, egress 443 | **EKS only** |
| Ingress | one `Gateway` (`istio-ingress/agentflow-gateway`), wildcard TLS from `ClusterIssuer agentflow-ca` | both |
| Admin UIs | published locally, `kubectl port-forward` only on AWS (`make aws-ui`) | both |
| Database | RDS security group allows 5432 from the **node security group**, not a CIDR | AWS |

**The kindnet caveat, stated plainly.** `NetworkPolicy` is an API, not an
implementation. kind's default CNI accepts the objects and enforces nothing, so
locally they are documentation and a lint target. On EKS the VPC CNI enforces
them. Claiming otherwise in an interview is a trap, which is why it is written
at the top of
[`00-default-deny.yaml`](../../deploy/platform/network-policies/manifests/00-default-deny.yaml).
Fixing it locally is `disableDefaultCNI: true` plus Cilium or Calico.

The other honest limit: `NetworkPolicy` says "pod X may open TCP to pod Y on
port Z", never "with a valid identity". mTLS is the identity half.
`AuthorizationPolicy` — "who may call what" — is not deployed yet and is item one
of the network section in
[`interview-talking-points.md`](interview-talking-points.md).

---

## Secrets

Nothing secret is in Git. Ever. The `.gitignore` covers `.env`, `*.tfstate`,
`*.pem` and `*.key`, but the design is what makes it true, not the ignore file:

```
local:  .env  --(scripts/seed-local-secrets.sh)-->  ns platform-secrets
                                                          |
aws:    AWS Secrets Manager  <--(IRSA)--  External Secrets Operator
        agentflow/demo/{app,db,ca,rabbitmq}                |
                                                           v
                                          Secret agentflow-api-secrets, ...
```

One `ClusterSecretStore` named `agentflow`, two providers: `kubernetes` pointed
at `platform-secrets` locally, AWS Secrets Manager through IRSA role
`agentflow-demo-eso` on EKS. The `ExternalSecret` objects and the resulting
`Secret` names are identical in both, so the application never knows which it
got.

`make aws-bootstrap` pushes the values: Terraform creates empty secret shells,
the script fills them from your `.env` and a CA it generates into
`~/.agentflow/ca`. No value passes through a state file, a plan output or the
script's stdout — it reads and reports lengths, never contents.

The gap: **no rotation**. Secrets Manager can rotate, ESO would re-sync the
`Secret`, and nothing restarts the pods holding the old value in their
environment. Reloader plus a rotation Lambda is the fix, and it is not built.

---

## IAM and identity

| Identity | Mechanism | Scope |
|---|---|---|
| GitHub Actions to AWS | OIDC provider + role `agentflow-github-actions` | trust condition pinned to `repo:bilLkarkariy/AgentFlow:environment:aws-demo`, so only workflows running in that reviewed environment can assume it |
| External Secrets to Secrets Manager | IRSA role `agentflow-demo-eso` | read on `agentflow/demo/*` |
| EBS CSI driver | IRSA role `agentflow-demo-ebs-csi` | the add-on's managed policy |
| Loki to S3 | IRSA role, scoped to the Loki bucket | |
| Cluster access | EKS `authentication_mode: API`, access entries | the CI role gets an explicit access entry; no `aws-auth` ConfigMap editing |

There is no long-lived AWS access key anywhere: not in the repository, not in
GitHub secrets, not in the cluster.

**Argo CD pulls.** CI never holds a kubeconfig, so a compromised workflow can
push a bad image and edit a tag — which the canary analysis and the signature
policy are there to catch — but it cannot talk to the API server.

---

## Known gaps

Ordered by how much they would matter if this carried traffic.

1. **No `AuthorizationPolicy`.** mTLS proves identity; nothing yet restricts
   which identity may call which service.
2. **NetworkPolicies are inert on kind.** Real on EKS, decorative locally.
3. **No secret rotation that lands.** Rotating in Secrets Manager does not
   restart the consumers.
4. **PSS is `warn`, not `enforce`**, because of `istio-init`. With `istio-cni`
   (already enabled on AWS) this could move to `enforce`.
5. **Signature verification is `Audit` on kind.** Only AWS actually gates.
6. **Public EKS API endpoint, `0.0.0.0/0`.** A demo convenience;
   `api_allowed_cidrs` exists to narrow it.
7. **Nodes in public subnets, no NAT.** A cost decision
   ([ADR 0002](../adr/0002-eks-spot-graviton-public-no-nat.md)), not a security
   one, and the wrong shape for production.
8. **Argo CD is `admin`/`admin` locally.** A throwaway cluster on `127.0.0.1`;
   the AWS install keeps the chart-generated random password. SSO is what a real
   one needs.
9. **Kyverno reports and cleanup controllers are off** to save memory on a
   laptop, so policy violations are blocked at admission but not reported.
10. **No audit trail beyond `git log`.** No control-plane audit logs, no
    CloudTrail, no GuardDuty.
11. **SBOMs are attested but not verified.** Provenance is produced, not
    required.
12. **Etcd secrets encryption and CMKs are off.** Default AWS-managed keys only.

---

Related: [`interview-talking-points.md`](interview-talking-points.md) turns each
of these into the object that would fix it;
[`../adr/0007-kyverno-cosign-verification.md`](../adr/0007-kyverno-cosign-verification.md)
and [`../adr/0008-external-secrets-secrets-manager.md`](../adr/0008-external-secrets-secrets-manager.md)
argue the two biggest choices.
