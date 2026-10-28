output "cluster_name" {
  description = "kind cluster name."
  value       = module.kind_cluster.cluster_name
}

output "kube_context" {
  description = "kubectl context to use."
  value       = module.kind_cluster.kube_context
}

output "kubeconfig_path" {
  description = "Kubeconfig written by the kind provider (gitignored)."
  value       = module.kind_cluster.kubeconfig_path
  sensitive   = true
}

output "argocd_url" {
  description = "ArgoCD UI, once the Istio ingress gateway is healthy."
  value       = "http://argocd.${var.domain}${var.http_port == 80 ? "" : ":${var.http_port}"}"
}

output "urls" {
  description = "Admin and application URLs served by the ingress gateway."
  value = {
    for svc in [
      "api", "studio", "dashboard", "grafana", "argocd",
      "kiali", "rollouts", "prometheus", "alertmanager",
    ] :
    svc => "http://${svc}.${var.domain}${var.http_port == 80 ? "" : ":${var.http_port}"}"
  }
}

output "gitops" {
  description = "Repository and revision reconciled by platform-root."
  value = {
    repo_url = var.gitops_repo_url
    revision = var.gitops_revision
    profile  = var.platform_profile
    env      = "local"
    domain   = var.domain
  }
}
