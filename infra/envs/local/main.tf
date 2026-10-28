########################################################################
# AgentFlow local platform bootstrap.
#
# Terraform owns exactly three things:
#   1. the kind cluster,
#   2. the ArgoCD release,
#   3. the root Application `platform-root` (deploy/argocd/root-app chart).
#
# Everything else is reconciled by ArgoCD from deploy/platform/bootstrap.
########################################################################

locals {
  # Single source of truth for every pinned version (deploy/versions.yaml).
  versions = yamldecode(file("${path.module}/../../../deploy/versions.yaml"))

  kubeconfig_path = abspath("${path.module}/agentflow-local-config")
  kube_context    = "kind-${var.cluster_name}"
}

module "kind_cluster" {
  source = "../../modules/kind_cluster"

  cluster_name    = var.cluster_name
  node_image      = local.versions.kubernetes.kind_node_image
  kubeconfig_path = local.kubeconfig_path
  http_port       = var.http_port
  https_port      = var.https_port
  worker_count    = var.worker_count
  wait_for_ready  = true
}

########################################################################
# ArgoCD
########################################################################

resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = local.versions.argocd.chart_version
  namespace        = var.argocd_namespace
  create_namespace = true

  # CRDs + controller + the root Application need a generous window on a
  # cold kind cluster (image pulls).
  timeout       = 900
  wait          = true
  atomic        = false
  wait_for_jobs = false

  values = [
    file("${path.module}/../../../deploy/argocd/argocd-values.yaml"),
    file("${path.module}/../../../deploy/argocd/argocd-values-local.yaml"),
  ]

  depends_on = [module.kind_cluster]
}

# The root Application is a separate release: Helm cannot create a CR in the
# same release that installs its CRD (the argo-cd chart ships the Application
# CRD as a template).
resource "helm_release" "platform_root" {
  name      = "platform-root"
  chart     = "${path.module}/../../../deploy/argocd/root-app"
  namespace = var.argocd_namespace
  wait      = false

  set = [
    { name = "argocdNamespace", value = var.argocd_namespace },
    { name = "repoURL", value = var.gitops_repo_url },
    { name = "gitRevision", value = var.gitops_revision },
    { name = "env", value = "local" },
    { name = "domain", value = var.domain },
    { name = "profile", value = var.platform_profile },
  ]

  depends_on = [helm_release.argocd]
}
