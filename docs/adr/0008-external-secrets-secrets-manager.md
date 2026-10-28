# 0008 — External Secrets Operator over AWS Secrets Manager

## Status

Accepted, 2026-09-06.

## Context

The application needs `OPENAI_API_KEY`, a RabbitMQ URL, a Celery broker URL, a
Postgres connection string and some optional OAuth credentials. The GitOps tree
is a **public repository**, so none of those can be in it — not encrypted,
not base64, not anywhere.

The awkward part is that there are two environments with genuinely different
secret backends:

- **kind**, on a laptop, with no AWS account and possibly no network. Whatever
  is chosen must work offline and for free.
- **EKS**, where the right answer is obviously AWS Secrets Manager, reached
  without any static credential.

And whatever is chosen must produce **the same `Secret` names with the same
keys** in both, because the charts consume them by `existingSecret` and the
application only ever sees environment variables.

## Decision

**External Secrets Operator**, one `ClusterSecretStore` named `agentflow`, two
providers behind it:

```
local:  provider kubernetes  ->  namespace platform-secrets
                                 (filled from your own .env by
                                  scripts/seed-local-secrets.sh)

aws:    provider aws/SecretsManager  ->  agentflow/demo/{app,db,ca,rabbitmq}
                                         via IRSA role agentflow-demo-eso
```

The `ExternalSecret` objects and the resulting `Secret` names are identical in
both environments:

| `Secret` | Keys |
|---|---|
| `agentflow-api-secrets` | `OPENAI_API_KEY`, `RABBITMQ_URL`, `CELERY_BROKER_URL`, optional OAuth |
| `agentflow-worker-secrets` | `CELERY_BROKER_URL` |
| `agentflow-db` (aws only) | `POSTGRES_URL` — locally CloudNativePG generates `agentflow-db-app` key `uri` |
| `agentflow-ca` | the private CA that `ClusterIssuer agentflow-ca` signs with |

`make aws-bootstrap` fills the Secrets Manager entries: **Terraform creates the
empty shells, a script pushes the values**, reading `.env` and a CA it generates
into `~/.agentflow/ca`. No secret value ever reaches a state file, a plan output,
a CI log or the script's own stdout — it reports lengths, never contents.

## Consequences

**Positive**

- **No secret in Git, and no mechanism that could put one there.** Not an
  encrypted blob, not a sealed one: the repository contains references only.
- **No static AWS credential in the cluster.** IRSA gives the
  `external-secrets` ServiceAccount an IAM identity; there is no access key to
  rotate or leak.
- One contract, two providers. The charts, the `ExternalSecret` objects and the
  application are provider-agnostic, so "how do secrets work here" has one
  answer with a footnote, not two answers.
- The local path costs nothing and works offline, which keeps the free demo
  genuinely free.
- Terraform never sees a value, so `terraform show` and any state backup are
  safe to hand to someone.
- The same operator handles the private CA, so TLS material follows the same
  path as application secrets.

**Negative**

- **No rotation that lands.** This is the honest gap. Secrets Manager can rotate
  and ESO would re-sync the `Secret`, but nothing restarts the pods that already
  read the old value into their environment. Rotation nothing consumes is
  theatre.
- Secrets are **environment variables**, not mounted files, so they appear in
  `/proc/<pid>/environ` and in a crash dump. Mounted files with
  `subPath`-free volumes would be better and would also make rotation
  observable.
- ESO is another controller with cluster-wide read on the `ClusterSecretStore`'s
  backend. Compromising it compromises everything it can read.
- The local `kubernetes` provider means the "source of truth" locally is a
  `Secret` in another namespace, seeded by a script. That is a demo shape, not a
  secret manager.
- `agentflow/demo/db` uses `recovery_window_in_days = 0` so `aws-down` really
  deletes it. That is right for an ephemeral demo and would be a serious mistake
  anywhere else — a deleted secret with no recovery window is gone.
- Two owners for the same `Secret` name is a real trap: if a chart sets
  `secrets.create: true` while ESO also manages that name, the two fight. The
  rule is one owner only, and it is written in `deploy/README.md`.

## Alternatives considered

**Sealed Secrets (Bitnami)** — encrypted values *in* Git, decrypted by a
controller with a cluster-held private key. Genuinely good, and it would work
offline. Rejected because it puts ciphertext in a public repository (fine
cryptographically, uncomfortable in practice), because rotating the sealing key
means re-sealing every secret, and because it has no story for "the same secret,
sourced from AWS in one environment and from a file in another".

**SOPS + age, with the Argo CD KSOPS plugin** — same objection about ciphertext
in Git, plus a Config Management Plugin in the Argo CD repo-server, which is a
sharp edge in an otherwise plugin-free setup.

**HashiCorp Vault** — the most capable option: dynamic database credentials with
a TTL, real rotation, leases, an audit log. Rejected as far too much
infrastructure for a demo: Vault itself needs storage, unsealing, HA and its own
operational story, and on the laptop it would cost more RAM than the entire
observability stack. It is what I would reach for if the requirement were
short-lived database credentials.

**AWS Secrets Store CSI driver** — mounts secrets as files, no `Secret` object
at all, which is better for blast radius. Rejected because it only solves the
AWS half: the local cluster would need a completely different mechanism, and the
"two providers, one contract" property is the thing that makes this
maintainable.

**Plain `Secret` objects created by a script** — what the local environment
effectively is underneath. Rejected as the general answer because it is not
declarative: nothing reconciles it, and drift is invisible.

## In production I would

- **Make rotation real.** A Secrets Manager rotation Lambda for the database
  credential, a short `refreshInterval` on the `ExternalSecret`, and
  **Reloader** watching the `Secret` so the pods that consume it actually
  restart. Then a scheduled test that rotates in a staging environment and
  asserts the application survived it.
- **Prefer IAM database authentication** over a stored password entirely, so the
  most sensitive credential does not exist.
- **Mount secrets as files** rather than environment variables, and give the
  application a reload path, so rotation does not require a restart at all.
- **Scope the IRSA policy per secret ARN**, and give each service its own role
  rather than one ESO role that can read everything. Move to **EKS Pod Identity**
  for new roles — same idea, much less OIDC plumbing.
- **Separate the store per environment and per sensitivity**: a
  `ClusterSecretStore` for platform-wide material, a namespaced `SecretStore`
  for anything a single team owns.
- **Recovery windows on**, 30 days, everywhere except deliberately ephemeral
  demo secrets.
- **Audit**: CloudTrail on `GetSecretValue`, alerting on reads from unexpected
  principals. A secret store with no audit trail answers "was it leaked?" with
  a shrug.
