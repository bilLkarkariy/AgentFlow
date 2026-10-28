# agentflow-service

The single "golden path" chart behind every AgentFlow workload: `agentflow-api`,
`agentflow-worker`, `agentflow-studio` and `agentflow-dashboard`. The four
services differ only by values (`deploy/envs/base/<svc>.yaml` +
`deploy/envs/<env>/<svc>.yaml`); the templates are never forked.

| | |
|---|---|
| Chart version | `0.1.0` |
| App version | `0.1.0` (overridden per service by `image.tag`) |
| Kubernetes | `>= 1.29`, validated against 1.32 |
| Release name | is the object name: release `agentflow-api` renders `Rollout/agentflow-api`, `Service/agentflow-api`, ... |

## What it renders

| Object | Rendered when |
|---|---|
| `Deployment` | `rollout.enabled: false` |
| `Rollout` (`argoproj.io/v1alpha1`) | `rollout.enabled: true` |
| `Service` (ClusterIP, port name `http`) | `service.enabled: true` |
| `ServiceAccount` | `serviceAccount.create: true` |
| `ConfigMap` | always (from `config`; its sha256 is the pod annotation `checksum/config`) |
| `Secret` | `secrets.create: true` |
| `VirtualService` (`networking.istio.io/v1`) | `istio.virtualService.enabled: true` |
| `DestinationRule` (`networking.istio.io/v1`) | `istio.destinationRule.enabled: true` or Istio canary routing |
| `HorizontalPodAutoscaler` (`autoscaling/v2`) | `hpa.enabled: true` |
| `PodDisruptionBudget` (`policy/v1`) | `pdb.enabled: true` **and** `replicaCount >= 2` (or `hpa.minReplicas >= 2`) |
| `ServiceMonitor` (`monitoring.coreos.com/v1`) | `serviceMonitor.enabled: true` (needs `service.enabled`) |
| `Job` (migrations) | `migrations.enabled: true` |

The Deployment/Rollout share one `podTemplate` named template, so probes,
security contexts, env and volumes behave identically in both modes.

## Values

### Identity and image

| Key | Default | Description |
|---|---|---|
| `nameOverride` | `""` | Object name. Empty means the release name. |
| `appLabel` | `""` | Istio/Prometheus `app` label (`api`, `worker`, `studio`, `dashboard`). Empty falls back to the name. Also the DestinationRule subset selector. |
| `version` | `""` | `version` pod label (Istio canonical revision, canary analysis key). Empty falls back to `image.tag`, then `.Chart.AppVersion`. |
| `image.repository` | `ghcr.io/billkarkariy/agentflow-api` | Always overridden per service. |
| `image.tag` | `""` | `sha-<7>` / `main` / `latest`. Empty falls back to `.Chart.AppVersion`. |
| `image.pullPolicy` | `IfNotPresent` | |
| `imagePullSecrets` | `[]` | e.g. `[{name: ghcr-creds}]`. |

### Workload

| Key | Default | Description |
|---|---|---|
| `replicaCount` | `1` | Not rendered when `hpa.enabled` (the HPA owns the field). |
| `command` / `args` | `[]` | Entrypoint override. |
| `containerPort` | `3000` | Container port, always named `http` (api 3000, worker 9100, SPA 8080). |
| `terminationGracePeriodSeconds` | `30` | |
| `revisionHistoryLimit` | `5` | |
| `podAnnotations` | `{}` | `prometheus.io/scrape\|port\|path`, `proxy.istio.io/config`, ... |
| `podLabels` | `{}` | Merged on top of the chart pod labels. |
| `podSecurityContext` | `runAsNonRoot`, uid/gid/fsGroup `10001`, `seccompProfile: RuntimeDefault` | |
| `containerSecurityContext` | `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `drop: [ALL]` | |
| `resources` | `100m/128Mi` requests, `256Mi` memory limit | No CPU limit on purpose. |
| `volumes` / `volumeMounts` | `[]` | Needed for any writable path, see *Read-only root filesystem*. |
| `nodeSelector`, `tolerations`, `affinity`, `topologySpreadConstraints` | empty | Passed through verbatim. |
| `serviceAccount.create` | `true` | |
| `serviceAccount.name` | `""` | Empty means the object name (or `default` when `create: false`). |
| `serviceAccount.annotations` | `{}` | e.g. `eks.amazonaws.com/role-arn`. |
| `serviceAccount.automountServiceAccountToken` | `false` | |

### Configuration and secrets

| Key | Default | Description |
|---|---|---|
| `config` | `{}` | Plain env, rendered as a ConfigMap consumed with `envFrom`. A change rolls the pods (`checksum/config`). |
| `secrets.existingSecret` | `""` | Secret consumed with `envFrom` (e.g. `agentflow-api-secrets`). |
| `secrets.create` | `false` | Render a Secret from `secrets.data`. Local/dev only. Mutually exclusive with `existingSecret`. |
| `secrets.data` | `{}` | `stringData` entries. Never commit real values: production secrets come from External Secrets Operator. |
| `database.existingSecret` | `""` | Secret holding the Postgres URL (local `agentflow-db-app`, aws `agentflow-db`). |
| `database.secretKey` | `""` | Key inside it (local `uri`, aws `POSTGRES_URL`). Both fields together render the env var `POSTGRES_URL`. |
| `extraEnv` | `[]` | Verbatim `EnvVar` entries. |
| `extraEnvFrom` | `[]` | Verbatim `EnvFromSource` entries. |
| `runtimeConfig.enabled` | `false` | SPA runtime configuration. |
| `runtimeConfig.values` | `{}` | Key `K` becomes the container env var `APP_<K>` **directly** (no ConfigMap): `API_BASE_URL` -> `APP_API_BASE_URL`. The nginx entrypoint turns those into `/config.js` (`window.__APP_CONFIG__`). |

### Probes

| Key | Default | Description |
|---|---|---|
| `probes.startup` | `httpGet /health:http`, `failureThreshold: 30`, `periodSeconds: 5` | |
| `probes.liveness` | `httpGet /health:http`, `periodSeconds: 20`, `timeoutSeconds: 3` | |
| `probes.readiness` | `httpGet /health/ready:http`, `periodSeconds: 10`, `timeoutSeconds: 5` | |

Each probe takes `httpGet` **or** `exec` (never both) plus any standard timing
field. `enabled: false` omits the probe completely. Because Helm merges maps,
switching a probe from `httpGet` to `exec` requires removing the default first:

```yaml
probes:
  readiness:
    httpGet: null                 # removes the chart default
    exec:
      command: ["/bin/sh", "-c", "test -f /tmp/ready"]
```

(`helm template` and ArgoCD honour that `null`; `helm lint` does not strip it
and prints a harmless `funcMap fail` info line, which is why no `ci/` profile
uses `exec`.)

### Networking

| Key | Default | Description |
|---|---|---|
| `service.enabled` | `true` | `false` for the worker (no inbound traffic). |
| `service.type` | `ClusterIP` | Ingress always goes through the Istio gateway. |
| `service.port` | `80` | Port name is always `http`, targetPort is the container port name. |
| `service.appProtocol` | `http` | |
| `service.annotations` | `{}` | |
| `istio.virtualService.enabled` | `false` | |
| `istio.virtualService.gateways` | `[istio-ingress/agentflow-gateway]` | |
| `istio.virtualService.hosts` | `[]` | e.g. `[api.127.0.0.1.sslip.io]`. Empty falls back to the internal name. |
| `istio.virtualService.streamingPaths` | `[]` | URI matches routed to the `streaming` route: `{prefix: /ws/flow}`, `{exact: ...}` or `{regex: ...}`. |
| `istio.virtualService.timeout` | `30s` | `primary` route only. |
| `istio.virtualService.retries` | `attempts: 2`, `retryOn: connect-failure,refused-stream,reset` | `primary` route only. |
| `istio.destinationRule.enabled` | `false` | Implied by Istio canary routing. |
| `istio.destinationRule.trafficPolicy` | `{}` | Passed through verbatim. |

The VirtualService always renders its routes in this order:

1. `streaming` (only when `streamingPaths` is non-empty): `timeout: 0s`,
   `retries.attempts: 0`, so SSE/websocket connections are never cut or replayed.
2. `primary`: the timeout and retry policy above.

### Canary

| Key | Default | Description |
|---|---|---|
| `rollout.enabled` | `false` | Render a Rollout instead of a Deployment. |
| `rollout.canary.steps` | `10%` / pause 60s / `50%` / pause 60s | Verbatim `strategy.canary.steps`. |
| `rollout.canary.maxSurge` | `"25%"` | |
| `rollout.canary.maxUnavailable` | `0` | |
| `rollout.canary.abortScaleDownDelaySeconds` | `30` | |
| `rollout.canary.trafficRouting.istio.enabled` | `false` | Subset traffic shifting on a single Service. Requires `istio.virtualService.enabled` and forces the DestinationRule on. |
| `rollout.canary.analysis.enabled` | `false` | |
| `rollout.canary.analysis.templates` | `[]` | e.g. `[{templateName: istio-success-rate, clusterScope: true}]`. |
| `rollout.canary.analysis.startingStep` | `1` | |

With Istio routing the Rollout gets
`trafficRouting.istio.virtualService.routes: ["primary", "streaming"]` (the
`streaming` entry only when `streamingPaths` is set) and
`destinationRule: {name: <fullname>, canarySubsetName: canary, stableSubsetName: stable}`.
There is **no** canary Service: both subsets sit behind the single Service and
are told apart by the `rollouts-pod-template-hash` label that Argo Rollouts adds
to the DestinationRule at runtime (hence the ArgoCD `ignoreDifferences` on
VirtualService weights and DestinationRule subsets).

The analysis is always called with `workload=<fullname>`,
`namespace=<release namespace>` and `canary-version` read from the pod label
`version` — the exact contract of the `istio-success-rate`
ClusterAnalysisTemplate.

### Scaling and availability

| Key | Default | Description |
|---|---|---|
| `hpa.enabled` | `false` | `autoscaling/v2`, targets the Rollout or the Deployment. |
| `hpa.minReplicas` / `hpa.maxReplicas` | `1` / `3` | |
| `hpa.targetCPUUtilizationPercentage` | `70` | |
| `hpa.targetMemoryUtilizationPercentage` | `null` | Omitted when null. |
| `hpa.behavior` | `{}` | Passed through verbatim. |
| `pdb.enabled` | `true` | Ignored while the workload runs a single replica. |
| `pdb.minAvailable` | `1` | |
| `pdb.maxUnavailable` | `null` | Set one or the other, not both. |

### Observability

| Key | Default | Description |
|---|---|---|
| `serviceMonitor.enabled` | `false` | Kept off in mesh mode: scraping goes through the pod-annotation ScrapeConfig. |
| `serviceMonitor.path` / `port` / `interval` | `/metrics` / `http` / `30s` | |
| `serviceMonitor.scrapeTimeout` | `""` | Omitted when empty. |
| `serviceMonitor.labels` | `{}` | So the Prometheus instance selects it. |

### Migrations

| Key | Default | Description |
|---|---|---|
| `migrations.enabled` | `false` | api only. |
| `migrations.command` | `node node_modules/typeorm/cli.js migration:run -d dist/src/data-source.js` | |
| `migrations.args` | `[]` | |
| `migrations.backoffLimit` | `3` | |
| `migrations.activeDeadlineSeconds` | `600` | |
| `migrations.ttlSecondsAfterFinished` | `600` | |
| `migrations.podAnnotations` | `{sidecar.istio.io/inject: "false"}` | Without this the Job never completes: the sidecar keeps running. |
| `migrations.resources` | `{}` | Empty reuses `resources`. |

The Job is named `<fullname>-migrate-<revision>` and carries
`helm.sh/hook: pre-install,pre-upgrade` (weight `-5`,
`before-hook-creation,hook-succeeded`) plus `argocd.argoproj.io/hook: PreSync`.
It runs with the same image, env, `envFrom`, security context and volumes as the
app, and `restartPolicy: Never`. Its pod labels are deliberately **not** the
selector labels, so a running migration is never added to the Service endpoints.

## Conventions

- **Every `enabled` defaults to `false`** except `service`, `serviceAccount.create`,
  `pdb` and the three probes.
- **Read-only root filesystem.** `containerSecurityContext.readOnlyRootFilesystem`
  is `true`, so any process that writes (Node's tmp files, nginx cache) needs:

  ```yaml
  volumes:      [{ name: tmp, emptyDir: {} }]
  volumeMounts: [{ name: tmp, mountPath: /tmp }]
  ```

- **Strict schema.** `values.schema.json` rejects unknown keys at the top level
  and inside `image`, `service`, `rollout`, `probes`, `istio`, `migrations`,
  `runtimeConfig`, `database`, `secrets`, `hpa` and `pdb`, so a typo in an env
  values file fails the render instead of silently deploying a default:

  ```console
  $ helm template . --set imag.tag=x
  Error: values don't meet the specifications of the schema(s) ...
  - at '': additional properties 'imag' not allowed
  ```

  `config`, `extraEnv`, `resources`, `podAnnotations`, the security contexts and
  the other pass-through blocks stay free-form.
- **Labels.** `app.kubernetes.io/*` (with `part-of: agentflow`) on every object;
  selector labels are `app.kubernetes.io/name` + `app.kubernetes.io/instance`
  only, and are immutable. Pods and the Rollout/Deployment metadata also carry
  the Istio pair `app` / `version` (quoted, since a tag can look numeric).

## The four profiles

Each profile has a runnable values file under `ci/`.

### 1. api — `ci/api-values.yaml`

Rollout, Istio canary with analysis, migrations, database secret, streaming
routes.

```yaml
appLabel: api
containerPort: 3000
rollout:
  enabled: true
  canary:
    trafficRouting: { istio: { enabled: true } }
    analysis:
      enabled: true
      templates: [{ templateName: istio-success-rate, clusterScope: true }]
migrations: { enabled: true }
database: { existingSecret: agentflow-db-app, secretKey: uri }
secrets: { existingSecret: agentflow-api-secrets }
istio:
  virtualService:
    enabled: true
    hosts: [api.127.0.0.1.sslip.io]
    streamingPaths:
      - prefix: /ws/flow
      - prefix: /socket.io
      - regex: "^/agents/[^/]+/flow/(execute|run)$"
  destinationRule: { enabled: true }
```

Renders: ConfigMap, ServiceAccount, Service, Rollout, VirtualService,
DestinationRule, PodDisruptionBudget, migration Job.

### 2. worker — `ci/worker-values.yaml`

Deployment, no Service, metrics/health on 9100, HPA.

```yaml
appLabel: worker
containerPort: 9100
service: { enabled: false }
hpa: { enabled: true, minReplicas: 1, maxReplicas: 3 }
probes:
  startup:   { httpGet: { path: /healthz, port: http } }
  liveness:  { httpGet: { path: /healthz, port: http } }
  readiness: { httpGet: { path: /healthz, port: http } }
```

Renders: ConfigMap, ServiceAccount, Deployment, HorizontalPodAutoscaler.

### 3. studio / dashboard (SPA) — `ci/spa-values.yaml`

Rollout with Istio canary but no analysis, nginx-unprivileged on 8080, runtime
configuration as `APP_*` env vars.

```yaml
appLabel: studio
containerPort: 8080
rollout:
  enabled: true
  canary:
    trafficRouting: { istio: { enabled: true } }
    analysis: { enabled: false }
runtimeConfig:
  enabled: true
  values:
    API_BASE_URL: https://api.127.0.0.1.sslip.io
    RABBITMQ_MGMT_URL: https://rabbitmq.127.0.0.1.sslip.io
```

Renders: ConfigMap, ServiceAccount, Service, Rollout, VirtualService,
DestinationRule, PodDisruptionBudget.

### 4. plain Deployment — `ci/deployment-values.yaml`

No mesh, no canary: Deployment, Service, PDB and a ServiceMonitor for a cluster
without the pod-annotation ScrapeConfig.

```yaml
replicaCount: 2
serviceMonitor:
  enabled: true
  labels: { release: kube-prometheus-stack }
pdb: { enabled: true, minAvailable: 1 }
secrets: { create: true, data: { PLACEHOLDER: replace-me } }
```

Renders: ConfigMap, Secret, ServiceAccount, Service, Deployment,
PodDisruptionBudget, ServiceMonitor.

## Validation

```bash
cd deploy/charts/agentflow-service

helm lint .
for f in ci/*.yaml; do helm lint . -f "$f"; done

for f in ci/*.yaml; do
  helm template agentflow-x . -f "$f" --namespace agentflow \
    | kubeconform -strict -summary -kubernetes-version 1.32.0 \
        -schema-location default \
        -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json'
done
```

CRD schemas (Rollout, VirtualService, DestinationRule, ServiceMonitor) come from
the datree CRDs-catalog, so the second command needs network access.
