terraform {
  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "0.5.1"
    }
  }
}

variable "cluster_name" {
  type        = string
  description = "Name of kind cluster"
  default     = "agentflow-local"
}

resource "kind_cluster" "this" {
  name           = var.cluster_name
  wait_for_ready = true

  node_image = "kindest/node:v1.32.0"
}

output "kubeconfig_path" {
  value = kind_cluster.this.kubeconfig_path
}

output "endpoint" {
  value = kind_cluster.this.endpoint
}

output "cluster_ca_certificate" {
  value = kind_cluster.this.cluster_ca_certificate
}

output "client_certificate" {
  value = kind_cluster.this.client_certificate
}

output "client_key" {
  value = kind_cluster.this.client_key
}
