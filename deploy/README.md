# `deploy/` — the GitOps tree

Everything a cluster runs lives here. Nothing is applied by hand: Terraform
creates the cluster and Argo CD, Argo CD reconciles this directory, and CI
only ever edits an image tag.

- `deploy/platform/**` — the platform layer (Istio, Argo Rollouts, observability,
  policies). Owned by the `platform-root` Application. See
  `deploy/platform/bootstrap/values.yaml`.
- `deploy/charts/**`, `deploy/envs/**`, `deploy/argocd/envs/**` — the application
  layer, described below.

---

## How a commit reaches a pod

```
git push main
   |
   v
GitHub Actions  build-images.yml
   build 4 images x 2 architectures -> Trivy -> cosign -> GHCR
   |
   v
yq -i '.image.tag = "sha-<7>"'  deploy/envs/local/{api,worker,dashboard,studio}.yaml
commit "chore(gitops): promote sha-<7> to local [skip ci]"
   |
   v
Argo CD  agentflow-apps -> ApplicationSet agentflow-services-local
   renders deploy/charts/agentflow-service with
   deploy/envs/base/<svc>.yaml + deploy/envs/local/<svc>.yaml
   |
   v
api: PreSync migration Job -> Rollout canary 10% -> 50% -> 100%
     AnalysisRun (istio-success-rate) aborts and rolls back on 5xx
```

The AWS environment is the same picture with one difference: nothing bumps
`deploy/envs/aws/*.yaml` automatically. `promote-aws.yml` opens a pull request,
a human merges it, and Argo CD does the rest.

### Why the tag lives in `deploy/envs/<env>/`

It is the only thing that changes on a deploy, so it is the only thing CI is
allowed to write. The base file, the chart and the Application never move, which
means the diff of a release is one line and `git log deploy/envs/local/api.yaml`
is the deployment history.

`APP_VERSION` is *not* duplicated next to the tag: `deploy/envs/base/api.yaml`
reads it back from the pod label `version`, which the chart derives from
`image.tag`. One bump, nothing to keep in sync.

---

## Directory map

```
deploy/
  versions.yaml                     single source of truth for chart versions
  charts/
    agentflow-service/              golden path: api, worker, studio, dashboard
    agentflow-infra/                CNPG Cluster, Redis, RabbitMQ, local Secrets
  envs/
    base/{api,worker,dashboard,studio,infra}.yaml    shared values
    local/{...}.yaml                                 kind overrides (CI bumps the tag)
    aws/{...}.yaml                                   EKS overrides (PR promotion)
  argocd/
    argocd-values*.yaml             the Argo CD install itself (Terraform)
    envs/local/
      cnpg-operator.yaml            Application, wave -2, chart cloudnative-pg
      infra.yaml                    Application, wave -1, chart agentflow-infra
      services.yaml                 ApplicationSet, one Application per service
    envs/aws/                       the same three files, aws values
  platform/                         the platform layer (not this document)
```

`deploy/argocd/envs/<env>/` is what the wave-20 platform Application
`agentflow-apps` points at, with `directory.recurse`. Adding a file there adds
an Application; there is no list to update.

There is no `AppProject` here on purpose: `platform` and `agentflow` are created
by `deploy/platform/bootstrap` at wave -1, and everything in this tree runs under
`project: agentflow`.

---

## Contracts

The values files are the contract between the charts and the application code.
Change one side and the other breaks, so they are listed here in full.

### Names

| kind | name | note |
|---|---|---|
| Rollout | `agentflow-api`, `agentflow-studio`, `agentflow-dashboard` | canary |
| Deployment | `agentflow-worker` | HPA 1..3 |
| Service | `agentflow-api`, `agentflow-studio`, `agentflow-dashboard` | `:80`, port name `http` |
| Service | `agentflow-db-rw` `:5432` | created by CloudNativePG |
| Service | `agentflow-redis` `:6379` | port name `tcp-redis` |
| Service | `agentflow-rabbitmq` `:5672` | port name `tcp-amqp` |
| Secret | `agentflow-api-secrets`, `agentflow-worker-secrets` | infra chart (local) / ESO (aws) |
| Secret | `agentflow-db-app` key `uri` (local), `agentflow-db` key `POSTGRES_URL` (aws) | -> env `POSTGRES_URL` |

The release name **is** the object name (`agentflow-api` -> Rollout
`agentflow-api`), so the ApplicationSet sets `helm.releaseName` explicitly.

### Ports, probes, scraping

| service | port | liveness | readiness | prometheus |
|---|---|---|---|---|
| api | 3000 | `GET /health` | `GET /health/ready` | pod annotation, port 3000 |
| worker | 9100 | `GET /healthz` | `GET /healthz` | pod annotation, port 9100 |
| studio, dashboard | 8080 | `GET /healthz` | `GET /healthz` | none |
| postgres | 5432 | operator | operator | pod annotation, port 9187 |
| rabbitmq | 5672 | `rabbitmq-diagnostics ping` | `check_port_connectivity` | pod annotation, port 15692 |
| redis | 6379 | `redis-cli ping` | `redis-cli ping` | none |

The worker has **no** `/health`, only `/healthz`, and all three of its probes
point there. `serviceMonitor.enabled` is `false` everywhere: in mesh mode
Prometheus scrapes by pod annotation through a `ScrapeConfig`, so there are no
Prometheus Operator objects to keep in sync with the mesh.

### Environment

| variable | local | aws |
|---|---|---|
| `DEPLOY_ENV` | `local` | `aws` |
| `POSTGRES_SSL` | `"false"` | `"true"` (RDS `rds.force_ssl=1`) |
| `OTEL_TRACES_SAMPLER_ARG` | `"1.0"` | `"0.1"` |
| `APP_API_BASE_URL` (SPA) | `https://api.agentflow.test` | `https://api.<domain>` |
| `APP_RABBITMQ_MGMT_URL` (dashboard) | `https://rabbitmq.agentflow.test` | `http://localhost:15672` (port-forward) |

Shared by both: `PORT=3000`, `NODE_ENV=production`, `LOG_LEVEL=info`,
`REDIS_HOST=agentflow-redis`, `REDIS_PORT=6379`, `API_URL=http://127.0.0.1:3000`
(the api calls itself over the loopback; the worker uses
`API_URL=http://agentflow-api`), `OTEL_EXPORTER_OTLP_ENDPOINT`,
`OTEL_SERVICE_NAME=api.agentflow`,
`OTEL_TRACES_SAMPLER=parentbased_traceidratio`.

### Hosts

| service | local | aws |
|---|---|---|
| api | `api.agentflow.test` | `api.DOMAIN_PLACEHOLDER` |
| studio | `studio.agentflow.test` | `studio.DOMAIN_PLACEHOLDER` |
| dashboard | `dashboard.agentflow.test` | `dashboard.DOMAIN_PLACEHOLDER` |
| rabbitmq management | `rabbitmq.agentflow.test` | port-forward |

All through Gateway `istio-ingress/agentflow-gateway`.

`DOMAIN_PLACEHOLDER` is literal in Git: the AWS domain is
`<ingress-eip-with-dashes>.sslip.io` and is only known once Terraform has
created the EIPs, so it is substituted at cluster creation.

---

## Everyday commands

```sh
make lint-deploy                 # the gate: renders and validates everything
make template-api ENV=local      # one service to stdout
make template-infra ENV=aws
make diff-envs                   # what aws changes, per service, merged values
```

`make lint-deploy` runs five checks:

| target | what it proves |
|---|---|
| `lint-charts` | both charts lint against every `ci/` profile |
| `lint-values` | every service x env and infra x env renders and passes `kubeconform -strict` |
| `lint-gitops` | the Applications and ApplicationSets are valid Argo CD objects |
| `lint-platform` | the platform catalogue still renders for both environments |
| `lint-versions` | no chart pin has drifted from `deploy/versions.yaml` |

`kubeconform` uses the vanilla Kubernetes schemas plus the
[datree CRDs-catalog](https://github.com/datreeio/CRDs-catalog) for Rollout,
Application, VirtualService, DestinationRule and the CNPG Cluster, so a bad
field in a CRD is caught here rather than by the API server.

---

## Adding a service

Four steps, no template to copy.

1. **Image** — add it to the matrix of `.github/workflows/build-images.yml` and
   to the `yq` bump list of the `promote-local` job.
2. **Base values** — `deploy/envs/base/<name>.yaml`. Start from the closest
   existing file; the four profiles of the chart are documented in
   `deploy/charts/agentflow-service/README.md`.
3. **Env values** — `deploy/envs/local/<name>.yaml` and
   `deploy/envs/aws/<name>.yaml`, holding only `image.tag`, the host, the
   replica count and whatever else genuinely differs.
4. **Generator** — one entry in the `list` generator of
   `deploy/argocd/envs/{local,aws}/services.yaml`:

   ```yaml
   - name: <name>
     wave: "2"
   ```

Then `make lint-deploy`. There is no chart to write: if the service does not
fit `agentflow-service`, that is a signal about the service, not about the
chart.

### About those sync waves

The annotation on the generated Applications documents intent (api first, then
the consumers). It does **not** order them: Applications produced by an
ApplicationSet are independent objects, and sync waves only order resources
*inside* one Application's sync. The real ordering guarantee is the PreSync
migration Job inside the api Application, which must succeed before any api pod
is created, and the wave -1 infra Application, which must be healthy before
that.

---

## Promoting to AWS

```sh
gh workflow run promote-aws.yml -f tag=sha-1a2b3c4
```

The workflow opens a pull request on `deploy/envs/aws/*.yaml` with the digests
and the `cosign verify` command in the body. Review it, merge it, and Argo CD
runs the same canary on EKS.

Before the first promotion the AWS environment needs three things that are not
in this directory: the cluster (`make aws-up`), the `agentflow-db` and
`agentflow-rabbitmq` Secrets projected by External Secrets Operator, and the
real domain substituted for `DOMAIN_PLACEHOLDER`.

---

## Troubleshooting

| symptom | cause | fix |
|---|---|---|
| `agentflow-infra` stuck `OutOfSync`, `no matches for kind "Cluster"` | CNPG CRDs not installed yet | wait for the wave -2 `cnpg-operator` Application; the Cluster carries `SkipDryRunOnMissingResource=true` so this resolves itself |
| api pods `CrashLoopBackOff`, `POSTGRES_URL` empty | `agentflow-db-app` not created yet, or the wrong `database.secretKey` | local uses key `uri`, aws uses `POSTGRES_URL`; check `kubectl -n agentflow get secret` |
| migration Job never finishes | the Job got an Istio sidecar | `migrations.podAnnotations` must keep `sidecar.istio.io/inject: "false"` |
| VirtualService flaps between `Synced` and `OutOfSync` | Argo Rollouts rewrites the route weights | that is what the global `ignoreDifferences` in `argocd-cm` are for (`/spec/http/*/route/*/weight`) |
| `agentflow-api-secrets` conflict between two Applications | `appSecrets.create` is true while External Secrets also owns the name | one owner only: `appSecrets.create: false` wherever ESO manages the Secret |
| api channel dies with `PRECONDITION_FAILED` on `agentflow.flow-run` | the queue is declared both by the api and by RabbitMQ `definitions.json` | keep `rabbitmq.definitions.declareAppQueue: false` unless both sides declare identical arguments |
| worker Deployment shows a replica diff | nothing: the HPA owns `spec.replicas` and the chart omits the field when `hpa.enabled` | — |
| `make lint-versions` fails | a chart pin drifted | `deploy/versions.yaml` is the source of truth; fix the pin |
| dashboard DLQ link 404s locally | `rabbitmq.agentflow.test` missing from `/etc/hosts` | add it (`scripts/hosts-setup.sh`) or use `kubectl -n agentflow port-forward svc/agentflow-rabbitmq 15672` |

Useful one-liners:

```sh
kubectl -n argocd get applications.argoproj.io -o wide
kubectl argo rollouts get rollout agentflow-api -n agentflow -w
kubectl -n agentflow get cluster agentflow-db          # CNPG
kubectl -n agentflow logs -l job-name --tail=-1 --prefix   # migration Job (agentflow-api-migrate-<n>)
```
