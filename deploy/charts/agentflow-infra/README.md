# agentflow-infra

The stateful dependencies of the AgentFlow workloads, in namespace `agentflow`:
a **CloudNativePG Cluster**, **Redis** and **RabbitMQ**, plus the two dummy
application Secrets used on the laptop.

One chart, two shapes:

| | local (kind) | aws (EKS) |
|---|---|---|
| Postgres | CNPG Cluster `agentflow-db`, 1 instance, 2Gi | RDS (`postgresql.cnpg.enabled: false`) |
| Redis | StatefulSet, 1Gi PVC | same, `gp3` |
| RabbitMQ | StatefulSet, 2Gi PVC, Secret created here | same, Secret from External Secrets |
| App Secrets | created here with dummy values | created by External Secrets Operator |

Rendered by `deploy/argocd/envs/<env>/infra.yaml` at sync wave **-1**, with
`deploy/envs/base/infra.yaml` + `deploy/envs/<env>/infra.yaml`.

```sh
make template-infra ENV=local
make lint-deploy
```

## Why none of these pods gets a sidecar

Every pod here carries `sidecar.istio.io/inject: "false"`.

They speak raw TCP (5432, 6379, 5672). The mesh brings no routing, no canary
and no useful telemetry for them, and a sidecar would only add a slower start
and a second thing to debug when the database will not come up. The namespace
still runs `PeerAuthentication` STRICT: that policy applies to workloads *with*
a sidecar, and Istio automatic mTLS detects that these destinations have none
and falls back to plaintext for the clients calling them.

## PostgreSQL (CloudNativePG)

The operator is a separate Application (`cnpg-operator`, sync wave -2, chart
`cloudnative-pg` pinned in `deploy/versions.yaml`). This chart only declares a
`postgresql.cnpg.io/v1` Cluster; the operator does the rest:

| object | name | used by |
|---|---|---|
| Service (primary) | `agentflow-db-rw` | the api and the migration Job |
| Service (replicas) | `agentflow-db-ro` | nothing yet |
| Service (any) | `agentflow-db-r` | nothing yet |
| Secret | `agentflow-db-app` | `deploy/envs/local/api.yaml` -> `POSTGRES_URL` |

`agentflow-db-app` is generated for the `owner` role and contains
`username`, `password`, `host`, `port`, `dbname`, `pgpass`, **`uri`**,
`jdbc-uri`, `fqdn-uri` and `fqdn-jdbc-uri`. The api reads the `uri` key, which
is why `deploy/envs/local/api.yaml` says `database.secretKey: uri`.

Two details worth knowing:

- **`argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true`** on the
  Cluster. On a fresh cluster the CRD arrives with the wave -2 Application;
  without this annotation ArgoCD fails the whole app on a server-side dry-run
  before the CRD exists.
- **`inheritedMetadata`** is the operator-side equivalent of `podAnnotations`:
  the operator copies those annotations and labels onto every object it creates
  for the Cluster. That is how the instance pods opt out of the sidecar and get
  scraped on port 9187 (`monitoring.enablePodMonitor` stays `false`: this
  platform scrapes by annotation, not with Prometheus Operator objects).

Backups (`postgresql.cnpg.backup`) render a `barmanObjectStore` block with
`s3Credentials.inheritFromIAMRole`, so credentials come from IRSA and never
from a file. It is off by default and the `destinationPath` is a placeholder;
enabling it also means setting `serviceAccountAnnotations` with the role ARN.
There is no `ScheduledBackup` object: enabling `backup` gives continuous WAL
archiving, and a schedule is one more manifest to add when it is actually
wanted.

## Redis

`redis:7-alpine`, one replica, `--appendonly yes` on a 1Gi PVC, uid 999,
read-only root filesystem, probes are `redis-cli ping`.

Service `agentflow-redis:6379`, port name `tcp-redis`. The api reaches it with
`REDIS_HOST=agentflow-redis` / `REDIS_PORT=6379`.

## RabbitMQ

`rabbitmq:3.13-management-alpine`, one replica, 2Gi PVC at `/var/lib/rabbitmq`,
uid 999.

| port | name | why |
|---|---|---|
| 5672 | `tcp-amqp` | api producer, worker consumer |
| 15672 | `http-mgmt` | management UI, target of the dashboard DLQ link |
| 15692 | `http-metrics` | `rabbitmq_prometheus`, scraped by pod annotation |

`readOnlyRootFilesystem` is deliberately **false** here: the official
entrypoint writes `/etc/rabbitmq/conf.d/10-defaults.conf` on every start from
`RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS`.

Three files are mounted from the `agentflow-rabbitmq-config` ConfigMap, each
with `subPath` so the rest of `/etc/rabbitmq` stays intact:

- `enabled_plugins` — `[rabbitmq_management,rabbitmq_prometheus].`
- `conf.d/20-agentflow.conf` — ports, console logging, `load_definitions`
  (sorted after the entrypoint's `10-defaults.conf`)
- `definitions.json` — see below

### The DLQ, and what is deliberately *not* declared

The dashboard DLQ console links to `<mgmt>/#/queues/%2F/agentflow.flow-run.dlq`,
so the queue has to exist for the page to be useful. `definitions.json`
therefore declares:

- exchange `agentflow.dlx` (direct, durable)
- queue `agentflow.flow-run.dlq` (durable, no arguments)
- binding `agentflow.dlx` -> `agentflow.flow-run.dlq` with routing key
  `agentflow.flow-run`

It does **not** declare the application queue `agentflow.flow-run`. The api
asserts that queue itself on every start, and RabbitMQ closes the channel with
`PRECONDITION_FAILED` when a passive or active declaration disagrees with the
existing queue on durability or on `x-arguments`. Declaring it in two places
is a boot-order lottery, so the chart keeps the DLQ side only, which is
compatible with any declaration the api makes.

To get real dead-lettering later, flip
`rabbitmq.definitions.declareAppQueue: true` **and** make the api assert
`agentflow.flow-run` with exactly:

```
durable: true
arguments:
  x-dead-letter-exchange: agentflow.dlx
  x-dead-letter-routing-key: agentflow.flow-run
```

Until both sides agree, the DLQ stays a queue that nothing routes into.

### Credentials

`rabbitmq.auth.existingSecret` empty (local) means the chart creates Secret
`agentflow-rabbitmq` with `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`,
`RABBITMQ_DEFAULT_VHOST` and a derived `url`:

```
amqp://agentflow:agentflow@agentflow-rabbitmq:5672//
```

The trailing `//` is not a typo: the path of an AMQP URI is the virtual host,
so `.../` + `/` means vhost `/`.

Set `rabbitmq.auth.existingSecret` (as `deploy/envs/aws/infra.yaml` does) and
the chart creates no Secret at all: the same three keys plus `url` are expected
from External Secrets Operator, and no password reaches Git.

`definitions.json` carries no `users` block on purpose, so the default user is
still created from the environment on a blank node.

## Application Secrets

`appSecrets.create: true` (local only) renders:

- `agentflow-api-secrets` — `RABBITMQ_URL`, `CELERY_BROKER_URL` (both derived
  from the RabbitMQ values) plus every key of `appSecrets.data`
- `agentflow-worker-secrets` — `CELERY_BROKER_URL` plus `appSecrets.workerData`

The default `OPENAI_API_KEY: changeme` is a placeholder. Real keys reach the
kind cluster through `scripts/seed-local-secrets.sh` (namespace
`platform-secrets`) and External Secrets Operator.

**Keep `appSecrets.create: false` on any environment where External Secrets
Operator owns the same two names.** Two owners for one object is a permanent
ArgoCD conflict, not a race that settles.

## Values

See `values.yaml`, which is commented key by key, and `values.schema.json`,
which rejects unknown keys: a typo in `deploy/envs/<env>/infra.yaml` must fail
the render, not deploy silently.

`ci/local-values.yaml` and `ci/managed-values.yaml` are the two profiles
`make lint-charts` renders; between them they cover every branch of the
templates (backups, IRSA, external Secret, management VirtualService).
