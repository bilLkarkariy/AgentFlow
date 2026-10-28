# Architecture decision records

Ten decisions that shaped this platform, in [MADR](https://adr.github.io/madr/)
form. Each one says what the situation was, what was chosen, what that costs,
what was rejected and why, and — because this is a demo and not a production
system — a closing section on what I would do differently with real traffic and
a real budget.

They exist so that "why did you do it that way?" has a written answer that was
decided once, rather than an answer improvised under questioning.

| # | Decision | Status | The trade in one line |
|---|---|---|---|
| [0001](0001-ghcr-over-ecr.md) | GHCR rather than ECR | Accepted | free public multi-arch registry, at the price of a manual visibility toggle and no VPC endpoint |
| [0002](0002-eks-spot-graviton-public-no-nat.md) | EKS with spot Graviton nodes in public subnets, single AZ, no NAT | Accepted | 0.24 USD/h instead of ~0.60, at the price of every availability property |
| [0003](0003-rds-over-cnpg.md) | RDS on AWS, CloudNativePG on kind; Redis and RabbitMQ always in-cluster | Accepted | the only stateful thing that matters is not on a spot node |
| [0004](0004-istio-sidecar-over-ambient.md) | Istio sidecar mode rather than ambient | Accepted | Argo Rollouts and Kiali are wired to the sidecar contract |
| [0005](0005-in-repo-gitops.md) | The GitOps tree lives in the application repository | Accepted | one repository to clone, at the price of a shared blast radius |
| [0006](0006-argo-rollouts-canary-analysis.md) | Argo Rollouts canary with a Prometheus AnalysisRun | Accepted | a rollback that needs no human, at the price of two controllers fighting over one VirtualService |
| [0007](0007-kyverno-cosign-verification.md) | Kyverno for admission policy, including keyless cosign verification | Accepted | the supply chain is enforced at admission, not only in CI |
| [0008](0008-external-secrets-secrets-manager.md) | External Secrets Operator over AWS Secrets Manager | Accepted | one secret contract, two providers, no secret in Git |
| [0009](0009-sslip-private-ca-dns-tls.md) | `sslip.io` for DNS and a private CA for TLS | Accepted | no domain, no hosted zone, no ACM, at the price of a browser warning |
| [0010](0010-terraform-state-bootstrap-oidc.md) | Terraform: S3 native locking, a permanent bootstrap stack, an ephemeral demo stack, GitHub OIDC | Accepted | `make aws-up` is one command and nothing long-lived holds a credential |

---

## How to read one

Every record has the same six sections:

- **Status** — Accepted, and the date. None of these has been superseded yet.
- **Context** — the constraints that were actually binding. Usually money, RAM,
  or the fact that nobody is paid to operate this.
- **Decision** — what was done, concretely, with the file that implements it.
- **Consequences** — good and bad, both stated. A record with no negative
  consequences is a record that has not been thought about.
- **Alternatives considered** — what was rejected, and the specific reason.
  "It was more complex" is not a reason; "it needs a NAT gateway, which doubles
  the hourly cost" is.
- **In production I would** — the same decision re-taken with different
  constraints. This is the section an interviewer is really asking about.

## Adding one

Copy the closest existing file, take the next number, add a row to the table
above. Keep it to one decision. If a record needs "and also", it is two records.

Superseding rather than editing: set the old record's status to
`Superseded by 00XX`, leave its text alone, and write the new one. The value of
these files is the history, not the current state — the current state is the
code.
