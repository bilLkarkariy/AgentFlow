# 0005 — The GitOps tree lives in the application repository

## Status

Accepted, 2026-09-06.

## Context

Argo CD reconciles a Git repository. The classic advice is to put manifests in a
**separate** config repository, for two reasons that are usually stated together
but are actually different:

1. **Blast radius.** The pipeline needs write access to whatever holds the
   deployment state. If that is the source repository, a compromised workflow
   can rewrite source.
2. **Loop avoidance.** CI commits to the repository that triggers CI.

Against that, this is one repository, one author, one team, and a showcase whose
whole point is that a reader can clone it and see the entire path from
`git push` to a canary in one place.

## Decision

The GitOps tree lives at **`deploy/`** inside the application repository, split
so that it *could* be extracted later without rewriting anything:

```
deploy/versions.yaml       chart versions, read by Terraform and by the catalogue
deploy/charts/             agentflow-service (golden path), agentflow-infra
deploy/envs/{base,local,aws}/   values, one file per service
deploy/argocd/             the Argo CD install + one Application per env
deploy/platform/           the platform catalogue, by sync wave
```

With three rules that make it safe:

- **CI may only write `deploy/envs/<env>/*.yaml`**, and only the `image.tag`
  field, with `yq`. Nothing else.
- **Triple loop guard**: the promotion commit carries `[skip ci]`, the workflows
  that could react have a `paths` allow-list or `paths-ignore` excluding
  `deploy/**`, and the commit is made with `GITHUB_TOKEN`, which by design does
  not re-trigger workflows.
- **AWS is promoted by pull request**, never by a bot commit
  (`promote-aws.yml` opens a PR with the digests and the `cosign verify`
  command in the body).

## Consequences

**Positive**

- One `git clone` shows the application, its Dockerfile, its chart, its values,
  its Argo CD Application, its Terraform and its CI. For a repository whose
  purpose is to be read, that is the whole value.
- A change that spans code and configuration — a new environment variable, a new
  port, a new probe path — is **one commit and one review**. In a two-repository
  setup that is two PRs that must merge in the right order, which is where
  contract drift comes from.
- `git log deploy/envs/local/api.yaml` **is** the deployment history, in the same
  timeline as the code that was deployed.
- `make lint-deploy` can render every chart against every environment in CI,
  because the chart and the values are in the same checkout.

**Negative**

- **Shared blast radius.** The token that bumps a tag lives in a workflow in the
  repository that holds the source. Mitigated by scoping (one job, one field,
  `contents: write` only on that job) but not eliminated.
- **CI can commit to `main`.** The three loop guards work, and they are three
  because any one of them failing alone would be an infinite build loop.
- A `deploy/**`-only commit still shows up in the source repository's history,
  which makes `git log` noisier for someone reading the application's history.
- If this ever became several teams deploying several applications, the
  ownership boundaries would be wrong: `CODEOWNERS` can express them, a
  repository boundary enforces them.

## Alternatives considered

**Separate `agentflow-deploy` repository** — the textbook answer, and the right
one at team scale. Rejected here because it doubles the clone-and-read cost of a
showcase for a security property that only matters when "who may change the
code" and "who may change the deployment" are genuinely different sets of
people. The migration path is deliberately cheap: `git filter-repo --path
deploy/`, then change `repoURL` in `infra/envs/*/root-app.yaml.tftpl` and in the
Applications. Nothing else moves.

**Argo CD Image Updater** — no CI commit at all: the controller watches the
registry and writes back. Rejected because it makes the *registry* the source of
truth for what should be running, and because its write-back mechanism is either
a commit anyway or a `Application` parameter override that is invisible in Git.
The explicit `yq` bump is one line and it is auditable.

**Kustomize `newTag` overlays instead of Helm values** — the same idea in a
different syntax; the tree would still live somewhere. Orthogonal to this
decision.

**A release branch per environment** — `main` for local, `aws` for AWS, with
promotion as a merge. Attractive, and it makes promotion a genuine PR without a
bot. Rejected because two long-lived branches of the same platform tree drift,
and the drift is invisible until a sync fails. Directory-per-environment keeps
the diff between environments visible on every commit (`make diff-envs` prints
it).

**Flux instead of Argo CD** — a different tool, not a different repository
layout. Argo CD was chosen for the UI, which matters a great deal in a live
demo, and for `ApplicationSet`.

## In production I would

Split it, and keep everything else.

- **`agentflow-deploy`**, a repository whose only writers are the platform team
  and a narrowly scoped CI identity. The application repository's pipeline gets
  a token that can open a PR there and nothing more.
- **Promotion is always a pull request**, in every environment, not only in the
  one that costs money. Auto-merge on green for `dev`, human review for
  `staging` and `prod`.
- **`ApplicationSet` with a cluster generator** rather than a directory per
  environment: `dev`, `staging` and `prod` become clusters, and the values
  hierarchy stays `base/` + one overlay.
- **`CODEOWNERS`** on `envs/prod/**` so a production tag bump needs a specific
  approval, and branch protection that actually requires it.
- Keep `deploy/versions.yaml` as the single source of truth for chart pins, with
  Renovate opening the bumps and `make lint-deploy` as the required check. That
  part is already right.
- Keep the three loop guards. They are cheap and the failure mode they prevent
  is embarrassing.
