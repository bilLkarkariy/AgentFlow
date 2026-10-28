########################################################################
# hashicorp/helm 3.x uses the attribute syntax for the `kubernetes`
# block (it was a nested block in 2.x).
########################################################################

provider "kubernetes" {
  config_path    = local.kubeconfig_path
  config_context = local.kube_context
}

provider "helm" {
  kubernetes = {
    config_path    = local.kubeconfig_path
    config_context = local.kube_context
  }
}
