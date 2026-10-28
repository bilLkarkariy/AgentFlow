########################################################################
# Every variable has a default so that `terraform apply -auto-approve`
# from `make local-up` never prompts.
########################################################################

variable "cluster_name" {
  description = "kind cluster name (kubectl context is kind-<cluster_name>)."
  type        = string
  default     = "agentflow-local"
}

variable "http_port" {
  description = <<-EOT
    Host port forwarded to the ingress gateway NodePort 30080.
    80 with OrbStack. With Colima use 8080 (Colima cannot bind privileged
    host ports) and adjust the URLs printed by `make local-ui`.
  EOT
  type        = number
  default     = 80
}

variable "https_port" {
  description = "Host port forwarded to the ingress gateway NodePort 30443 (8443 with Colima)."
  type        = number
  default     = 443
}

variable "worker_count" {
  description = "Worker nodes on top of the control plane."
  type        = number
  default     = 1
}

variable "domain" {
  description = "Wildcard domain served by the ingress gateway. Resolved through /etc/hosts (scripts/hosts-setup.sh)."
  type        = string
  default     = "127.0.0.1.sslip.io"
}

variable "gitops_repo_url" {
  description = "Git repository ArgoCD reconciles from."
  type        = string
  default     = "https://github.com/bilLkarkariy/AgentFlow.git"
}

variable "gitops_revision" {
  description = "Git revision (branch, tag or SHA) tracked by the platform-root Application."
  type        = string
  default     = "main"
}

variable "platform_profile" {
  description = "Platform catalogue profile: `minimal` (core only) or `full` (everything)."
  type        = string
  default     = "full"

  validation {
    condition     = contains(["minimal", "full"], var.platform_profile)
    error_message = "platform_profile must be either \"minimal\" or \"full\"."
  }
}

variable "argocd_namespace" {
  description = "Namespace hosting ArgoCD."
  type        = string
  default     = "argocd"
}
