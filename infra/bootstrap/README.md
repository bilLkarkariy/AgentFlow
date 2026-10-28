# `infra/bootstrap` — the stack that never goes away

Everything else in `infra/` is disposable. This one is not.

`make aws-up` builds a VPC, an EKS cluster and an RDS instance; `make aws-down`
destroys them an hour later. That cycle needs four things that must already
exist and must survive it:

| # | Resource | Why it cannot be ephemeral |
|---|---|---|
| 1 | S3 bucket `agentflow-tfstate-<account_id>` | It holds the state of the stack that would destroy it |
| 2 | Budgets + Cost Anomaly Detection | A guardrail that only exists while the cluster runs guards nothing |
| 3 | GitHub OIDC provider + role `agentflow-github-actions` | The CI needs it *before* it can run `terraform apply` |
| 4 | Secrets Manager shells `agentflow/demo/{app,ca}` | The private CA is generated once; regenerating it per session would break every trusted client |

Run it **once per AWS account**, then forget it.

---

## What gets created

**State bucket** — versioned, encrypted (SSE-S3), all four public-access blocks
on, a bucket policy that denies non-TLS access, a lifecycle rule that expires
superseded versions after 30 days, and `prevent_destroy = true`.

There is **no DynamoDB lock table**. Locking uses the S3-native conditional
write introduced in Terraform 1.11, so every consumer must pass
`use_lockfile=true`:

```
-backend-config="bucket=agentflow-tfstate-<account_id>"
-backend-config="region=eu-west-1"
-backend-config="key=<stack>/terraform.tfstate"
-backend-config="use_lockfile=true"
-backend-config="encrypt=true"
```

Keys in use: `bootstrap/terraform.tfstate` and `aws-demo/terraform.tfstate`.

**Cost guardrails** — a monthly budget (15 USD, mail at 50 %, 80 %, 100 % actual
and 100 % forecast) and a daily budget (3 USD, mail at 100 %). A demo session
costs about 1 USD, so the daily budget is what catches a cluster left running
overnight. A `SERVICE`-dimension anomaly monitor mails you once a day when the
absolute impact reaches 5 USD.

**GitHub OIDC** — the provider for `token.actions.githubusercontent.com` and the
role `agentflow-github-actions`, assumable only by

- `repo:<owner/repo>:environment:aws-demo` (the `aws-up` / `aws-down` workflows,
  behind a required reviewer), and
- `repo:<owner/repo>:ref:refs/heads/main` (the `aws-guard` cron).

Session length 2 h, because `aws-up` takes ~25 min and `aws-down` ~20 min.
The role carries `AdministratorAccess`: see *Known trade-offs* below.

**Secret shells** — two empty `aws_secretsmanager_secret` resources.
Terraform creates the container and never the value, so no secret is written to
a state file or a plan output. `scripts/aws-bootstrap.sh` pushes the values.

| Secret | Shape | Filled from | Read by |
|---|---|---|---|
| `agentflow/demo/app` | `{"KEY": "value", ...}` | the repo's `.env` | External Secrets → `agentflow-api-secrets` |
| `agentflow/demo/ca` | `{"tls.crt": "...", "tls.key": "..."}` | `~/.agentflow/ca` | External Secrets → cert-manager `ClusterIssuer agentflow-ca` |

(`agentflow/demo/db` is **not** here: the RDS password is generated per session
by the `aws-demo` stack.)

---

## Cost

About **0.80 USD/month**, and it does not depend on whether a cluster is up.

| Item | Monthly |
|---|---|
| 2 Secrets Manager secrets @ 0.40 USD | 0.80 USD |
| 2 AWS Budgets (first two are free) | 0.00 USD |
| Cost Anomaly Detection | 0.00 USD |
| IAM role + OIDC provider | 0.00 USD |
| S3 state bucket (a few hundred KB) | ~0.00 USD |

For comparison, the DynamoDB lock table this stack does *not* create would have
added a line for nothing.

---

## How to run it

```bash
export ALERT_EMAIL="you@example.com"
make aws-bootstrap            # or: scripts/aws-bootstrap.sh
```

The script does the whole sequence: preflight, `terraform apply`, generate the
private CA if `~/.agentflow/ca` is empty, push both secret values, and print the
`-backend-config` flags for `infra/envs/aws-demo`. `DRY_RUN=1` prints the plan of
commands without touching anything; `-y` skips the apply confirmation.

By hand, if you prefer:

```bash
cp infra/bootstrap/terraform.tfvars.example infra/bootstrap/terraform.tfvars
terraform -chdir=infra/bootstrap init
terraform -chdir=infra/bootstrap apply
```

### Moving the state into S3 (optional, after the first apply)

The first apply necessarily runs on **local state** — the bucket does not exist
yet. Afterwards:

```bash
scripts/aws-bootstrap.sh --migrate-state
```

which uncomments the `backend "s3" {}` block in `backend.tf` and runs
`terraform init -migrate-state` with the right `-backend-config` flags and key
`bootstrap/terraform.tfstate`.

This is genuinely optional. Keeping the bootstrap state local on one laptop is a
defensible answer for a stack applied once a year, as long as
`infra/bootstrap/terraform.tfstate` is backed up. `.gitignore` already excludes
`*.tfstate*` and `.terraform/`.

### After the first apply

1. Confirm the **Cost Anomaly Detection subscription** mail. Until you click it,
   the anomaly alerts are silent (the budget alerts are not affected).
2. Create the GitHub environment `aws-demo` with a required reviewer, and set the
   variable `AWS_ROLE_ARN` to the `github_actions_role_arn` output.

---

## How to destroy it

You almost certainly do not want to. `make aws-down` destroys the demo estate and
leaves this stack alone by design.

If you are really closing the account:

1. Empty the bucket, including every non-current version — `terraform destroy`
   will not delete a bucket that still has objects.
2. Delete the `lifecycle { prevent_destroy = true }` block on
   `aws_s3_bucket.state` in `main.tf`. This is deliberate friction: a plan cannot
   remove it for you.
3. `terraform -chdir=infra/bootstrap destroy`.
4. If the state was migrated to S3, move it back first
   (`terraform init -migrate-state` with the backend block commented again), or
   the destroy deletes the bucket holding its own state mid-run.

Both secrets use `recovery_window_in_days = 0`, so their names are free
immediately and a later bootstrap will not hit "a secret with this name is
scheduled for deletion".

---

## What NOT to do

- **Do not add this stack to `aws-down`.** It is the cost guardrail and the CI
  trust anchor; deleting it during cleanup is how a forgotten resource becomes an
  invisible bill.
- **Do not put a value in the Secrets Manager resources.** A
  `secret_string` here lands in the state file in clear text. Values go through
  `aws secretsmanager put-secret-value`, which is what the script does.
- **Do not commit `terraform.tfvars` or `terraform.tfstate`.**
- **Do not hard-code the bucket name in `backend.tf`.** It contains the account
  id and this repository is public. The block stays a partial configuration and
  the name arrives through `-backend-config`.
- **Do not widen the OIDC trust condition.** Dropping the `sub` condition, or
  loosening it to `repo:<owner>/*`, hands `AdministratorAccess` to any workflow
  in any of those repositories, including one opened by a fork's pull request.
- **Do not regenerate the CA** unless you also re-run `make aws-trust-ca` on
  every machine that trusted the old one.

---

## Known trade-offs

**`AdministratorAccess` on the CI role.** Deliberate, and worth saying out loud
in an interview: the role creates and destroys a full VPC + EKS + RDS estate, so
a hand-written least-privilege policy would be a large guess that fails halfway
through a 25-minute apply. The production answer is to run the demo cycle once,
then generate the policy from CloudTrail with IAM Access Analyzer, and to keep
the blast radius contained with the `aws-demo` environment's required reviewer
and the `sub` condition above.

**SSE-S3 rather than SSE-KMS.** A customer-managed key is 1 USD/month, more than
the rest of this stack put together, and the state files hold no credential.
`trivy config` flags it (AVD-AWS-0132); the finding is ignored inline with that
reasoning next to the resource, not suppressed globally.

**No access logging on the state bucket.** It would need a second bucket for a
bucket that holds two objects; S3 data events in CloudTrail cover the same
question (AVD-AWS-0089, same treatment).

---

## Verification

```bash
terraform -chdir=infra/bootstrap init -backend=false
terraform -chdir=infra/bootstrap validate
terraform fmt -check -recursive infra/bootstrap
trivy config infra/bootstrap --severity HIGH,CRITICAL
shellcheck scripts/aws-bootstrap.sh
DRY_RUN=1 ALERT_EMAIL=you@example.com scripts/aws-bootstrap.sh
```

None of these need AWS credentials. `.terraform.lock.hcl` is locked for
`darwin_arm64` and `linux_amd64` so the laptop and the CI runner agree:

```bash
terraform -chdir=infra/bootstrap providers lock \
  -platform=darwin_arm64 -platform=linux_amd64
```
