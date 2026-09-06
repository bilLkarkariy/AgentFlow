# AgentFlow infrastructure (Terraform)

Terraform owns the *cluster* and *ArgoCD*, nothing else. Everything that runs
inside the cluster is reconciled by ArgoCD from `deploy/`, so the blast radius
of a `terraform apply` stays small and `make local-down` is always clean.

```
infra/
  envs/
    local/            kind cluster + ArgoCD + the platform-root Application   (WP7)
    aws-demo/         VPC, EKS, RDS, EIPs, IRSA + ArgoCD                      (WP12)
  bootstrap/          S3 state bucket, budget, GitHub OIDC, secret shells     (WP11)
  modules/
    kind_cluster/     kind topology and host port mappings                    (WP7)
```

## What `infra/envs/local` creates

1. A **kind** cluster named `agentflow-local`: one control plane, one worker,
   node image pinned in `deploy/versions.yaml`.
2. Host port mappings **80 -> NodePort 30080** and **443 -> NodePort 30443**,
   which is how `http://argocd.agentflow.test` reaches the Istio ingress
   gateway with no port-forward.
3. The **ArgoCD** Helm release, configured by
   `deploy/argocd/argocd-values.yaml` + `argocd-values-local.yaml`.
4. The root Application **`platform-root`**, rendered from
   `root-app.yaml.tftpl` into the chart's `extraObjects`. It points at
   `deploy/platform/bootstrap`, which fans out into one Application per
   platform component.

Nothing else. No Namespace, no CRD, no workload: those all arrive through
ArgoCD sync waves.

## Usage

```bash
make check-tools     # toolchain, VM size, ports 80/443, /etc/hosts
make local-up        # ~10-15 min on a cold cache
make local-wait      # re-run the wait loop on its own
make local-ui        # every URL + the ArgoCD credentials
make local-status    # nodes, Applications, pods that are not Running
make local-down      # terraform destroy
```

### Prerequisites

* **OrbStack** open, VM set to **10 GiB / 6 CPU** (`make check-tools` enforces
  a 9 GiB floor).
* One `sudo` for `scripts/hosts-setup.sh`, which writes a single
  `# agentflow` tagged line into `/etc/hosts`.
* A `.env` at the repository root if you want real agent runs;
  `scripts/seed-local-secrets.sh` otherwise seeds a dummy `OPENAI_API_KEY`.

### Colima instead of OrbStack

Colima cannot bind privileged host ports, so map 8080/8443 instead:

```bash
make local-up TF_VARS='-var http_port=8080 -var https_port=8443'
```

URLs then become `http://argocd.agentflow.test:8080`.

## Variables (`infra/envs/local`)

Every variable has a default, so `terraform apply` never prompts.

| Variable | Default | Purpose |
|---|---|---|
| `cluster_name` | `agentflow-local` | kind cluster / kubectl context suffix |
| `http_port` / `https_port` | `80` / `443` | host ports mapped to NodePorts 30080/30443 |
| `worker_count` | `1` | worker nodes on top of the control plane |
| `domain` | `agentflow.test` | wildcard domain served by the gateway |
| `gitops_repo_url` | `https://github.com/bilLkarkariy/AgentFlow.git` | repository ArgoCD reconciles |
| `gitops_revision` | `main` | branch/tag/SHA tracked by `platform-root` |
| `platform_profile` | `full` | `minimal` or `full` (see the catalogue) |
| `argocd_namespace` | `argocd` | namespace hosting ArgoCD |

Working on the `platform` branch before it is merged:

```bash
make local-up GITOPS_REV=platform
```

Short on RAM: `make local-up LOCAL_PROFILE=minimal` drops Loki, Alloy, Tempo,
the OTel collector, Kyverno, External Secrets and the NetworkPolicies.

## Versions

`deploy/versions.yaml` is the single source of truth. `infra/envs/local`
reads it with `yamldecode`, and `deploy/platform/bootstrap/values.yaml`
repeats the chart versions because a Helm chart cannot read a file outside
its own directory. Bump both together.

## Provider lock

The lock file covers macOS arm64 (the workstation) and linux amd64 (CI):

```bash
terraform -chdir=infra/envs/local providers lock \
  -platform=darwin_arm64 -platform=linux_amd64
```

## State

Local state on purpose for `infra/envs/local`: the cluster is disposable and
`*.tfstate` is gitignored. Only the AWS environments use the S3 backend
(`infra/bootstrap`, WP11).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `terraform apply` hangs on `kind_cluster` | Docker VM not started | Open OrbStack, then `make local-up` again |
| Port 80 already bound | Another local web server | Stop it, or use `TF_VARS='-var http_port=8080 -var https_port=8443'` |
| Applications stuck `Progressing` past wave 4 | istiod not ready, usually memory | `make local-status`, then `LOCAL_PROFILE=minimal` |
| `*.agentflow.test` does not resolve | `/etc/hosts` line missing | `scripts/hosts-setup.sh` |
| Browser TLS warning | Private CA `agentflow-ca` | Expected locally; use plain HTTP or trust the CA |
