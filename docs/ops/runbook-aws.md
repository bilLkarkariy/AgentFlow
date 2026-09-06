# Runbook: ephemeral EKS demo

The same platform on real AWS, created for a demo and destroyed the same hour.
About **25 minutes to create, 10 to destroy, ~0.24 USD per hour** while it
exists ([`cost.md`](cost.md)).

```sh
make aws-bootstrap    # once per AWS account, ever
make aws-up           # ~25 min, costs money from here on
make aws-ui           # port-forwards to the admin UIs
make aws-trust-ca     # stop the browser warning
make aws-down         # ~10 min
make aws-check-clean  # prove nothing is still billing
```

> **Anything you start here bills by the hour.** `make aws-up` writes
> `~/.agentflow/session` so `make aws-cost` can tell you what the session has
> cost so far, and it ends with a reminder to tear down. A forgotten cluster is
> about 6 USD per day; the `aws-guard.yml` cron and the 15 USD budget exist
> because that mistake is easy to make.

---

## 1. Account prerequisites

One-time, and mostly yours to do:

| # | What | How |
|---|---|---|
| 1 | AWS credentials on this machine | `aws configure` (or `aws sso login`). Nothing in this repo ever handles a credential. |
| 2 | The account may create EKS | Very new / free-tier-credit accounts sometimes cannot. `aws eks list-clusters --region eu-west-1` returning a permissions error is the fast check. |
| 3 | A budget alert address | `ALERT_EMAIL` for `make aws-bootstrap`. AWS sends a confirmation mail: **click it**, or the 15 USD budget alarms silently. |
| 4 | A `.env` with `OPENAI_API_KEY` | `make aws-bootstrap` pushes it into Secrets Manager `agentflow/demo/app`. |
| 5 | Region | `eu-west-1`, hard-coded in the `deploy/` overlays and cheapest for Graviton spot in Europe. |

For the CI-driven variant, also create the GitHub environment `aws-demo` with a
required reviewer, and a repository variable `AWS_ROLE_ARN` holding the
`agentflow-github-actions` role ARN that `make aws-bootstrap` printed.

---

## 2. `make aws-bootstrap` — once per account

`infra/bootstrap` is the stack that is **never destroyed**. It costs about
0.80 USD per month and holds the things the ephemeral stack needs to exist
before it can be created:

- S3 bucket `agentflow-tfstate-<account_id>`, versioned, encrypted,
  `prevent_destroy`, native lockfile (no DynamoDB table). Keys `bootstrap/` and
  `aws-demo/`.
- `aws_budgets_budget` at 15 USD with 50/80/100 % alerts, plus a cost anomaly
  monitor.
- GitHub OIDC provider and IAM role `agentflow-github-actions`, trusted only for
  `repo:bilLkarkariy/AgentFlow:environment:aws-demo`.
- Empty Secrets Manager shells `agentflow/demo/app` and `agentflow/demo/ca`.

```sh
ALERT_EMAIL=you@example.com make aws-bootstrap
```

Terraform creates the containers; the script fills the values, so no secret ever
reaches a state file, a plan output or your scrollback. It reads `.env` for the
application secret and generates a demo root CA into `~/.agentflow/ca` for the
TLS one. `DRY_RUN=1` prints every command instead of running it.

Note the outputs: `state_bucket`, `github_actions_role_arn`, `backend_config`.

---

## 3. `make aws-up` — the demo environment

```sh
make aws-up                          # SPOT, tracks main
make aws-up GITOPS_REV=platform      # track another branch
make aws-up CAPACITY_TYPE=ON_DEMAND  # when spot has no capacity
DRY_RUN=1 scripts/aws-up.sh          # print the whole sequence, touch nothing
```

| Phase | What happens | Time |
|---|---|---|
| 1. preflight | tools, `sts get-caller-identity`, state bucket exists, bootstrap secrets are non-empty, EKS version is in **standard** support (extended support costs 6x the control plane price) | < 1 min |
| 2. terraform | `init` with `-backend-config` from the bootstrap output, then `apply`: VPC, EKS, add-ons, node group, RDS, 2 EIPs, IRSA roles, Argo CD | 18-22 min |
| 3. kubeconfig | writes context `agentflow-aws`; removes the `default` flag from the `gp2` StorageClass so `gp3` is the only default | < 1 min |
| 4. render + commit | writes the facts that only exist now into `deploy/`, commits `chore(gitops): render aws environment [skip ci]`, pushes | < 1 min |
| 5. wait | nodes `Ready`, every `Application` `Synced/Healthy`, the NLB gets its EIPs, `GET /health` answers | 5-8 min |
| 6. report | URLs, `make aws-ui`, and the teardown reminder | instant |

Of that, roughly 12 minutes is the EKS control plane and 6 is RDS. They run in
parallel with everything they do not block.

### Phase 4 deserves a paragraph

Argo CD only ever reads Git. But the EIP allocation ids, the public subnet ids,
the `sslip.io` domain, the IRSA role ARNs and the Loki bucket name do not exist
until Terraform has run. Something has to bridge that gap.

`scripts/aws-render-env.sh` does it by writing those values into the files Argo
CD reads and committing them:

```
deploy/platform/istio/gateway/values-aws.yaml          EIP allocations, subnets
deploy/platform/external-secrets/values-aws.yaml       IRSA role ARN
deploy/platform/loki/values-aws.yaml                   S3 bucket, IRSA role ARN
deploy/platform/cert-manager/.../aws/wildcard-domain.yaml   the sslip.io domain
deploy/envs/aws/{api,studio,dashboard}.yaml            hosts, APP_API_BASE_URL
```

Every write is a `yq` path assignment, never a search-and-replace on a
placeholder, so the second `make aws-up` overwrites yesterday's account id as
happily as it overwrote the original placeholder. `--check` exits 1 when a file
would change, which is what `make aws-render-check` runs to detect drift between
`deploy/` and the live environment.

The alternative was a second templating layer (an ApplicationSet plugin, a
Config Management Plugin, or `argocd app set -p` from a script). This way the
environment is reproducible from the repository alone and `git log` shows which
infrastructure each sync belonged to. It is the honest trade-off between "no
generated files in Git" and "Argo CD reads only Git", and the ADR
[`0005-in-repo-gitops.md`](../adr/0005-in-repo-gitops.md) argues it.

### Verification checklist

```sh
terraform -chdir=infra/envs/aws-demo output            # domain, urls, endpoints
kubectl --context agentflow-aws get nodes -o wide      # 2 nodes, arm64, Ready
kubectl --context agentflow-aws -n argocd get applications.argoproj.io
kubectl --context agentflow-aws -n agentflow get pods  # every app pod 2/2

DOMAIN=$(terraform -chdir=infra/envs/aws-demo output -raw ingress_domain)
curl -sk "https://api.${DOMAIN}/health"                # {"status":"ok"}
curl -sk "https://api.${DOMAIN}/health/ready"          # Postgres + Redis + RabbitMQ
kubectl --context agentflow-aws -n istio-ingress get svc   # EXTERNAL-IP, not <pending>
kubectl --context agentflow-aws -n agentflow get externalsecret   # SecretSynced
```

Two more targets worth knowing:

```sh
make aws-kubeconfig    # rewrite the kubeconfig entry (context agentflow-aws)
make aws-render-check  # fail if deploy/ no longer matches the live environment
```

`make aws-check-clean` is the mirror image of all of this and only makes sense
after `make aws-down`.

---

## 4. Using it

```sh
make aws-status       # nodes, Applications, ingress address, the demo URLs
make aws-ui           # port-forwards the admin UIs and prints the credentials
make aws-trust-ca     # add the demo root CA to the login keychain
make aws-cost         # month-to-date by service, plus this session's estimate
```

| UI | After `make aws-ui` | Login |
|---|---|---|
| Argo CD | `http://localhost:8080` | `admin` / printed (masked unless `make aws-ui SHOW=1`) |
| Grafana | `http://localhost:3001` | printed |
| Kiali | `http://localhost:20001` | none |
| Argo Rollouts | `http://localhost:3100` | none |

Only `api`, `studio` and `dashboard` are published through the gateway. Every
admin UI is a `kubectl port-forward`: an anonymous Grafana on a public IP is not
a thing to demonstrate, and port-forwarding is also the honest answer to "how do
you reach internal tools in production" (you do not publish them; you use SSO
and a bastion or a VPN).

`make aws-trust-ca` adds `~/.agentflow/ca/ca.crt` to the macOS login keychain as
trusted. Without it the browser warns on every `https://*.sslip.io` page.
Removing it later is Keychain Access > login > Certificates > delete
`AgentFlow Demo CA`.

### Promoting an image to AWS

Local bumps itself; AWS does not. Promotion is a pull request:

```sh
gh workflow run promote-aws.yml -f tag=sha-1a2b3c4
```

The workflow branches `promote/aws-<tag>`, bumps `deploy/envs/aws/*.yaml`, and
opens a PR labelled `gitops, aws` whose body carries the image digests and the
`cosign verify` command. Review it, merge it, and Argo CD runs the same canary
on EKS that it ran on kind. There is deliberately no `make` target for this:
promotion to AWS is a reviewed pull request, not something a local command does.

Then the demo itself:

```sh
make demo-canary DEMO_ENV=aws TAG=sha-1a2b3c4
make demo-break  DEMO_ENV=aws TAG=sha-1a2b3c4
```

---

## 5. `make aws-down` — and proving it

```sh
make aws-down
make aws-check-clean
```

Order matters, because `terraform destroy` cannot delete a VPC that still has a
load balancer or an ENI in it, and neither of those belongs to Terraform:

1. `kubectl -n argocd delete applications --all --timeout=10m` — stops Argo CD
   from recreating what is about to be deleted.
2. Delete every remaining `Service type=LoadBalancer` and every PVC. This is
   what actually releases the NLB and the EBS volumes.
3. Wait until `describe-load-balancers` and `describe-volumes` come back empty.
   AWS deletes them asynchronously; destroying before they are gone is exactly
   how a destroy hangs for 20 minutes and then fails.
4. `terraform destroy`.
5. Recovery: if `helm_release.argocd` blocks the destroy (its cluster is
   already gone), `terraform state rm` it and destroy again; then sweep
   leftover ENIs and security groups by tag.

`make aws-check-clean` then looks for EKS clusters, EC2 instances, EBS volumes,
ENIs, load balancers, **unassociated Elastic IPs**, security groups, VPCs, RDS
instances, secrets pending deletion and CloudWatch log groups, and exits 1 if
anything is left. Unassociated EIPs are on that list because they are the
classic silent cost: 0.005 USD/h forever, attached to nothing.

---

## 6. Driving it from CI

`aws-up.yml` and `aws-down.yml` are `workflow_dispatch` workflows on the GitHub
environment `aws-demo` (required reviewer). They authenticate with OIDC through
`aws-actions/configure-aws-credentials` and the `agentflow-github-actions` role;
there is no long-lived AWS key in the repository.

```sh
gh workflow run aws-up.yml
gh workflow run aws-down.yml
```

`aws-guard.yml` runs on a 6-hour cron, fails if a cluster, load balancer or RDS
instance still exists, and takes an `auto_destroy` input. It is the safety net
for "the demo ended, the laptop closed, nobody ran `make aws-down`".

`terraform-ci.yml` runs `fmt`, `validate`, `tflint`, Trivy config scanning,
`shellcheck` and `actionlint` on every change under `infra/**` — with no
credentials at all, so it runs on pull requests from anywhere.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `apply` fails with a spot capacity error | no Graviton spot in that AZ right now | `make aws-up CAPACITY_TYPE=ON_DEMAND` (about +0.13 USD/h), or retry later |
| Ingress `Service` stuck `<pending>` | the number of EIP allocations does not equal the number of tagged public subnets | both are rendered by `scripts/aws-render-env.sh`; `kubectl -n istio-ingress describe svc` names the mismatch |
| NLB created but nothing answers | subnets missing `kubernetes.io/role/elb=1`, or the health check port is not 15021 | check the tags in `infra/envs/aws-demo/vpc.tf` and the annotations in `deploy/platform/istio/gateway/values-aws.yaml` |
| `terraform destroy` hangs on the VPC | an NLB or ENI created by Kubernetes, not by Terraform | that is what steps 1-3 of `aws-down` are for; run `make aws-down` again, it is idempotent |
| `helm_release.argocd` blocks the destroy | the cluster it manages is already gone | `terraform -chdir=infra/envs/aws-demo state rm helm_release.argocd`, then destroy again |
| `InvalidRequestException: secret is scheduled for deletion` | a previous `aws-down` deleted `agentflow/demo/db` with a recovery window | `aws secretsmanager restore-secret --secret-id agentflow/demo/db`, or wait it out. The demo secret uses `recovery_window_in_days = 0` precisely to avoid this |
| Control plane billed 6x | the EKS version fell out of standard support | `aws-up` preflight checks this before spending 25 minutes; bump `kubernetes.eks_version` in `deploy/versions.yaml` |
| Pods `CrashLoopBackOff` with `exec format error` | an amd64-only image on a Graviton node | every image is built for `linux/amd64` **and** `linux/arm64`; check the `merge` job of `build-images.yml` actually ran |
| api cannot reach RDS | `POSTGRES_SSL` is `"false"`, but `rds.force_ssl=1` | `deploy/envs/aws/api.yaml` must keep `POSTGRES_SSL: "true"` |
| `ExternalSecret` not `SecretSynced` | IRSA annotation missing or the role has no permission on that secret ARN | `kubectl -n external-secrets logs deploy/external-secrets`; the role ARN comes from the `eso_role_arn` output |
| Nodes vanish mid-demo | spot interruption | the node group runs 2..3 across three instance families; Kubernetes reschedules. It is a good thing to be asked about, not a thing to hide |
| A charge appears the day after | something survived the destroy | `make aws-check-clean`, then Cost Explorer grouped by service. Unassociated EIPs and orphan EBS volumes are the usual two |

---

Next: [`cost.md`](cost.md) for the numbers, or [`demo-script.md`](demo-script.md)
for the 10-minute walkthrough this environment exists to support.
