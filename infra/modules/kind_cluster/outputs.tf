output "cluster_name" {
  description = "Name of the kind cluster."
  value       = kind_cluster.this.name
}

output "kube_context" {
  description = "kubectl context created by kind."
  value       = "kind-${kind_cluster.this.name}"
}

output "kubeconfig_path" {
  description = "Path of the kubeconfig file written by the kind provider."
  value       = kind_cluster.this.kubeconfig_path
  sensitive   = true
}

output "endpoint" {
  description = "API server endpoint."
  value       = kind_cluster.this.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "PEM cluster CA certificate."
  value       = kind_cluster.this.cluster_ca_certificate
  sensitive   = true
}

output "client_certificate" {
  description = "PEM client certificate."
  value       = kind_cluster.this.client_certificate
  sensitive   = true
}

output "client_key" {
  description = "PEM client key."
  value       = kind_cluster.this.client_key
  sensitive   = true
}
