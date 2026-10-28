variable "cluster_name" {
  description = "Name of the kind cluster. The kubectl context becomes kind-<cluster_name>."
  type        = string
  default     = "agentflow-local"
}

variable "node_image" {
  description = "kindest/node image, pinned in deploy/versions.yaml (kubernetes.kind_node_image)."
  type        = string
}

variable "kubeconfig_path" {
  description = "Absolute path where the kind provider writes the kubeconfig of the cluster."
  type        = string
}

variable "http_port" {
  description = <<-EOT
    Host port mapped to the ingress gateway NodePort 30080.
    80 with OrbStack (default). Use 8080 with Colima, which cannot bind
    privileged host ports.
  EOT
  type        = number
  default     = 80
}

variable "https_port" {
  description = <<-EOT
    Host port mapped to the ingress gateway NodePort 30443.
    443 with OrbStack (default). Use 8443 with Colima.
  EOT
  type        = number
  default     = 443
}

variable "worker_count" {
  description = "Number of worker nodes in addition to the single control-plane node."
  type        = number
  default     = 1
}

variable "wait_for_ready" {
  description = "Block until every node and the core system pods report Ready."
  type        = bool
  default     = true
}
