########################################################################
# ArgoCD - the only thing this stack creates inside the cluster.
#
# Everything else (Istio, observability, Kyverno, ESO, the AgentFlow
# services) is reconciled by ArgoCD from deploy/platform/bootstrap, via
# the platform-root Application installed below. Exactly the two releases
# infra/envs/local installs, in the same order, from the same files, so
# there is one bootstrap story to explain and not two.
#
# Why two releases and not `extraObjects` in the argo-cd chart: that chart
# ships the Application CRD as a template, and Helm cannot reliably create
# a custom resource in the same release that installs its CRD (the
# discovery cache is still cold). See commit 9a5565b.
########################################################################

resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = local.argocd_chart_version
  namespace        = var.argocd_namespace
  create_namespace = true

  # Long enough for the CRDs, the controller and the first image pulls on
  # nodes that have just joined; short enough to fail the `aws-up` run
  # rather than hang it.
  timeout       = 600
  wait          = true
  atomic        = false
  wait_for_jobs = false

  values = [
    file("${path.module}/../../../deploy/argocd/argocd-values.yaml"),
    file("${path.module}/../../../deploy/argocd/argocd-values-aws.yaml"),
  ]

  depends_on = [
    # The node group must be able to schedule the ArgoCD pods, the EIPs
    # must exist before global.domain can be computed, and the database
    # must be reachable before wave 20 starts the api migration Job.
    module.eks,
    aws_eip.ingress,
    module.rds,
  ]
}

########################################################################
# The root Application. `values` + `yamlencode` rather than the `set`
# blocks infra/envs/local uses: the extraParameters keys are literally
# `global.aws.region` and friends, and helm's --set parser reads a dot as
# a nesting separator, so every key would need `\.` escaping and every
# comma-separated value a second round of `\,` escaping. A values
# document has no such syntax and survives review.
#
# Comma-separated values are passed unescaped on purpose: ArgoCD escapes
# them itself (cleanSetParameters) when it turns spec.source.helm
# .parameters into `helm --set`.
########################################################################

resource "helm_release" "platform_root" {
  name      = "platform-root"
  chart     = "${path.module}/../../../deploy/argocd/root-app"
  namespace = var.argocd_namespace

  # The Application takes 15-20 minutes to converge through 20 sync waves.
  # Terraform's job is done once the object exists; scripts/wait-apps.sh
  # is what actually waits.
  wait = false

  values = [yamlencode({
    argocdNamespace = var.argocd_namespace
    repoURL         = var.gitops_repo_url
    gitRevision     = var.gitops_revision
    env             = "aws"
    domain          = local.ingress_domain
    profile         = var.profile

    extraParameters = {
      "global.aws.region"    = var.region
      "global.aws.accountId" = local.account_id

      # IRSA role ARNs and the bucket name, so deploy/platform/*/values-aws.yaml
      # can stop carrying PLACEHOLDER literals once WP13 wires them through.
      "global.aws.esoRoleArn"  = aws_iam_role.eso.arn
      "global.aws.lokiRoleArn" = aws_iam_role.loki.arn
      "global.aws.lokiBucket"  = aws_s3_bucket.loki.id

      # One allocation id per public subnet, same order. A count mismatch
      # leaves the in-tree NLB in <pending> forever.
      "global.aws.ingressEipAllocations" = join(",", aws_eip.ingress[*].id)
      "global.aws.publicSubnets"         = join(",", module.vpc.public_subnets)
    }
  })]

  depends_on = [helm_release.argocd]
}
