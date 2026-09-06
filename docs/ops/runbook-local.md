# Runbook: local cluster (kind)

The whole platform on a laptop, free, in about 15 minutes. This is where 80 %
of the demo happens: Argo CD, Istio, Argo Rollouts canary with automatic
rollback, Prometheus/Grafana/Loki/Tempo, Kyverno and External Secrets all run
here exactly as they do on EKS.

```sh
make check-tools     # is this machine ready
make local-up        # cluster + Argo CD + everything Argo CD installs
make local-ui        # every URL and the Argo CD password
make local-down      # give the laptop its RAM back
```

---

## 1. Prerequisites

### Container runtime

**OrbStack** (free for personal use, light, binds privileged ports).
Open it once and set the VM to **10 GiB / 6 CPU** in Settings > System.
`make check-tools` fails below 9 GiB, because the `full` profile does not fit.

**Colima** works too, but it cannot bind host ports 80/443, so map high ports:

```sh
make local-up TF_VARS='-var http_port=8080 -var https_port=8443'
```

Every URL then gains `:8080`.

### Tools

```sh
brew install --cask orbstack
brew install kind kubernetes-cli helm kustomize istioctl yq
brew tap hashicorp/tap && brew install hashicorp/tap/terraform
```

That is the required set. The optional set makes the demo and the checks work
end to end:

```sh
brew install argocd kubeconform kyverno prometheus cosign trivy \
             hey k6 k9s stern jq shellcheck actionlint tflint
brew install argoproj/tap/kubectl-argo-rollouts
```

| Optional tool | What stops working without it |
|---|---|
| `kubectl-argo-rollouts` | the live canary view (`make demo-canary` still deploys) |
| `hey` | `scripts/loadgen.sh` falls back to a slower `curl` loop |
| `k6` | `make loadgen-k6` and its SLO thresholds |
| `kubeconform`, `kyverno`, `promtool` | `make lint-deploy` and `scripts/verify-security.sh` |
| `cosign`, `trivy` | verifying signatures and scanning images by hand |

### DNS and TLS

Nothing to configure. The default domain is `127.0.0.1.sslip.io`: public DNS
already resolves `anything.127.0.0.1.sslip.io` to `127.0.0.1`, and kind maps
host ports 80/443 onto the Istio ingress gateway's NodePorts 30080/30443.

If you set `DOMAIN` to something that is not a `sslip.io` / `nip.io` name,
`make local-up` runs `scripts/hosts-setup.sh`, which writes a single
`# agentflow` tagged line into `/etc/hosts` and asks for `sudo` once. Remove it
later with `scripts/hosts-setup.sh --remove`.

HTTPS is served by a private CA (`ClusterIssuer agentflow-ca`), so a browser
warns. Locally, use plain HTTP or accept the warning.

### Secrets

Copy `.env.example` to `.env` and put a real `OPENAI_API_KEY` in it if you want
agent runs to succeed. Without a `.env`, `scripts/seed-local-secrets.sh` seeds a
dummy key and everything else still works. Nothing from `.env` is ever
committed: it is loaded into the `platform-secrets` namespace, which is what
the local `ClusterSecretStore` reads.

---

## 2. Bring it up

```sh
make check-tools
make local-up                       # tracks branch main
make local-up GITOPS_REV=platform   # track another branch
make local-up LOCAL_PROFILE=minimal # short on RAM, see below
```

`make local-up` is one Terraform apply plus three scripts. Step by step:

| # | What runs | What it does | Typical time |
|---|---|---|---|
| 1 | `scripts/check-tools.sh` | tools, VM size, ports 80/443 | instant |
| 2 | `terraform apply` (`infra/envs/local`) | kind cluster `agentflow-local`, 1 control plane + 1 worker, host ports 80/443 mapped to NodePorts 30080/30443 | 1-2 min |
| 3 | same apply | Argo CD Helm release, values from `deploy/argocd/argocd-values{,-local}.yaml` | 1-2 min |
| 4 | same apply | the single `Application` **`platform-root`**, injected through the chart's `extraObjects` | seconds |
| 5 | `kind export kubeconfig` | context `kind-agentflow-local` | instant |
| 6 | `scripts/hosts-setup.sh` | skipped on a `sslip.io` domain | - |
| 7 | `scripts/seed-local-secrets.sh` | `platform-secrets/agentflow-demo-app` from your `.env` | instant |
| 8 | `make local-wait` | polls until every `Application` is `Synced` + `Healthy` | 8-15 min cold |

From step 4 on, **Terraform is done**. Argo CD reads `deploy/platform/bootstrap`
from GitHub and fans out one Application per component, wave by wave: namespaces,
cert-manager, Istio, Argo Rollouts, the observability stack, the policy layer,
and finally (wave 20) the application layer. See
[`architecture.md`](architecture.md#2-in-cluster-layers-by-sync-wave).

> **Argo CD reads GitHub, not your working copy.** A change that is not pushed
> to `GITOPS_REV` does not exist as far as the cluster is concerned. This is the
> single most common local surprise, and it is the point of GitOps, not a bug.

The first run pulls roughly 3 GB of images. 15 minutes cold, 5 warm.

### Watching it

```sh
make local-wait      # the same wait loop on its own, re-runnable
make local-status    # nodes, Applications with waves, pods that are not Running
kubectl -n argocd get applications.argoproj.io -w
k9s                  # if you like a TUI
```

### Images

Argo CD deploys the tag written in `deploy/envs/local/*.yaml`, which CI bumps on
every push to `main`. To run code that is not on GHCR yet:

```sh
make local-images                 # build 4 images as sha-<HEAD>, load into kind
make demo-canary TAG=sha-<HEAD>   # point the values file at them and deploy
```

---

## 3. URLs

`make local-ui` prints these with the credentials.

| UI | URL | Login |
|---|---|---|
| Argo CD | `http://argocd.127.0.0.1.sslip.io` | `admin` / `admin` |
| Grafana | `http://grafana.127.0.0.1.sslip.io` | anonymous, Viewer |
| Kiali | `http://kiali.127.0.0.1.sslip.io` | anonymous |
| Argo Rollouts | `http://rollouts.127.0.0.1.sslip.io` | none |
| Prometheus | `http://prometheus.127.0.0.1.sslip.io` | none |
| Alertmanager | `http://alertmanager.127.0.0.1.sslip.io` | none |
| API | `http://api.127.0.0.1.sslip.io/health` | none |
| Studio | `http://studio.127.0.0.1.sslip.io` | none |
| Dashboard | `http://dashboard.127.0.0.1.sslip.io` | none |

Handy deep links:

```
http://grafana.127.0.0.1.sslip.io/d/agentflow-overview
http://grafana.127.0.0.1.sslip.io/d/agentflow-canary
http://grafana.127.0.0.1.sslip.io/d/agentflow-llm-costs
http://kiali.127.0.0.1.sslip.io/console/graph/namespaces/?namespaces=agentflow&graphType=versionedApp
```

Argo CD credentials are `admin` / `admin` on purpose: a throwaway kind cluster
reachable only from `127.0.0.1`. The bcrypt hash is in
`deploy/argocd/argocd-values-local.yaml`, with the command that generated it.

---

## 4. Smoke test

```sh
curl -s http://api.127.0.0.1.sslip.io/health          # {"status":"ok"}
curl -s http://api.127.0.0.1.sslip.io/health/ready    # Postgres + Redis + RabbitMQ
curl -s http://api.127.0.0.1.sslip.io/metrics | grep -c '^agentflow_'   # >= 8

kubectl -n agentflow get pods       # every app pod is 2/2 (sidecar)
kubectl -n argocd get applications.argoproj.io   # all Synced/Healthy

scripts/verify-security.sh          # Kyverno, ESO, mTLS STRICT, end to end
scripts/check-rules.sh              # promtool on every PrometheusRule
make lint-deploy                    # renders and validates all of deploy/
```

Then the interesting part:

```sh
make demo-canary TAG=sha-1a2b3c4   # promoted 10 % -> 50 % -> 100 %
make demo-break  TAG=sha-1a2b3c4   # 30 % 5xx, AnalysisRun fails, rolled back
make demo-fix                      # remove the fault, watch it heal
```

See [`demo-script.md`](demo-script.md) for the narrated version.

---

## 5. Profiles

`LOCAL_PROFILE` decides how much of the catalogue Argo CD renders.

| Profile | Includes | Peak VM memory |
|---|---|---|
| `full` (default) | everything: Loki, Alloy, Tempo, OTel collector, Kyverno, External Secrets, NetworkPolicies | ~7-8 GiB |
| `minimal` | namespaces, cert-manager, metrics-server, Istio, Argo Rollouts, kube-prometheus-stack, Kiali, the app layer | ~4-5 GiB |

```sh
make local-up LOCAL_PROFILE=minimal
```

`minimal` still demonstrates GitOps, the mesh, the canary and the analysis. It
drops logs, traces and the policy layer. Switching back is `make local-up` with
no argument: Argo CD adds the missing Applications on the next sync.

---

## 6. Tear down

```sh
make local-down                      # terraform destroy, the whole kind cluster
scripts/hosts-setup.sh --remove      # only if you used a custom, non-sslip domain
```

There is nothing to clean up afterwards: the cluster was a container, the state
file is local and gitignored, and no cloud resource was ever created.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `terraform apply` hangs creating the kind cluster | the Docker VM is not running | open OrbStack, then `make local-up` again |
| `make check-tools` fails on VM memory | OrbStack default is 8 GiB | Settings > System: 10 GiB / 6 CPU |
| `make check-tools` warns `no '# agentflow' line in /etc/hosts` | it warns unconditionally, but `make local-up` skips `/etc/hosts` on a `sslip.io` domain | ignore it; it is a warning, not a failure |
| Port 80 or 443 already bound | another local web server | stop it, or `make local-up TF_VARS='-var http_port=8080 -var https_port=8443'` |
| Applications stuck `Progressing` past wave 4 | istiod not ready, almost always memory pressure | `make local-status`, then `kubectl top nodes`; if the node is squeezed, `make local-down && make local-up LOCAL_PROFILE=minimal` |
| Pods `Pending`, node `MemoryPressure` | full profile on an 8 GiB VM | same as above |
| App pods are `1/1` instead of `2/2` | no Istio sidecar | `kubectl get ns agentflow --show-labels` must show `istio-injection=enabled`; if the namespace predates istiod, `kubectl -n agentflow rollout restart deploy,rollout --all` |
| Migration Job never finishes | the Job got a sidecar, so the pod never exits | `migrations.podAnnotations` must keep `sidecar.istio.io/inject: "false"` |
| Your change does not appear | Argo CD reads GitHub, not your working copy | commit and push to `GITOPS_REV`, then `kubectl -n argocd annotate application <name> argocd.argoproj.io/refresh=normal --overwrite` |
| Argo CD is `Synced` but pods run the old image | the tag in `deploy/envs/local/*.yaml` did not change | `make demo-tag` shows what Git describes; CI bumps it on push to `main` |
| `ImagePullBackOff` on `ghcr.io/...` | the GHCR package is private, or the tag does not exist | make the four packages public in the GitHub UI, or `make local-images` and deploy that tag |
| First sync takes forever | ~3 GB of images on a cold cache | it is one-off; `kubectl get events -A --sort-by=.lastTimestamp` confirms it is pulls |
| `agentflow-infra` `OutOfSync`, `no matches for kind "Cluster"` | CNPG CRDs not installed yet | wait for the wave -2 `cnpg-operator` Application; it resolves itself |
| Browser TLS warning | private CA `agentflow-ca` | expected locally; use `http://` |
| `VirtualService` flaps `Synced`/`OutOfSync` | Argo Rollouts rewrites the route weights | that is what the global `ignoreDifferences` in `argocd-cm` are for |
| NetworkPolicies "do nothing" | kindnet does not enforce them | true, and documented in `deploy/platform/network-policies/manifests/00-default-deny.yaml`. They are enforced on EKS. See [`security.md`](security.md) |

Useful one-liners:

```sh
kubectl -n argocd describe application <name> | tail -40
kubectl argo rollouts get rollout agentflow-api -n agentflow -w
kubectl -n agentflow logs -l app=api --tail=100 --prefix | jq -R 'fromjson? // .'
istioctl proxy-status
istioctl analyze -n agentflow
stern -n agentflow .
```

---

Next: [`runbook-aws.md`](runbook-aws.md) for the ephemeral EKS environment, or
[`demo-script.md`](demo-script.md) for the 10-minute walkthrough.
