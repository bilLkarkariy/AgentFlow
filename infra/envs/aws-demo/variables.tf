########################################################################
# Every variable has a default: `make aws-up` runs
# `terraform apply -auto-approve` and must never prompt.
# terraform.tfvars.example documents the ones worth overriding.
########################################################################

variable "region" {
  description = "AWS region. eu-west-1 has the cheapest Graviton spot capacity of the European regions and is the value hard-coded in the deploy/ overlays."
  type        = string
  default     = "eu-west-1"
}

variable "kubernetes_version" {
  description = "EKS control plane version. null takes kubernetes.eks_version from deploy/versions.yaml, which is the single source of truth shared with the kind environment."
  type        = string
  default     = null
}

variable "node_arch" {
  description = "CPU architecture of the managed node group. arm64 (Graviton) is ~20% cheaper than x86_64 and every AgentFlow image is built multi-arch."
  type        = string
  default     = "arm64"

  validation {
    condition     = contains(["arm64", "amd64"], var.node_arch)
    error_message = "node_arch must be either \"arm64\" or \"amd64\"."
  }
}

variable "node_instance_types" {
  description = "Instance types offered to the spot allocator, cheapest first. Three families keep the odds of a spot capacity error low."
  type        = list(string)
  default     = ["t4g.large", "m6g.large", "m7g.large"]
}

variable "capacity_type" {
  description = "SPOT (default, ~70% cheaper) or ON_DEMAND. Fall back to ON_DEMAND if `aws-up` fails with a spot capacity error - see README."
  type        = string
  default     = "SPOT"

  validation {
    condition     = contains(["SPOT", "ON_DEMAND"], var.capacity_type)
    error_message = "capacity_type must be either \"SPOT\" or \"ON_DEMAND\"."
  }
}

variable "node_min_size" {
  description = "Minimum nodes in the managed node group."
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum nodes in the managed node group. 3 leaves room for one surge node during a rolling update."
  type        = number
  default     = 3
}

variable "node_desired_size" {
  description = "Desired nodes at creation time. Two t4g.large (4 vCPU / 16 GiB total) hold the full platform profile."
  type        = number
  default     = 2
}

variable "api_allowed_cidrs" {
  description = "CIDRs allowed to reach the public Kubernetes API endpoint. Narrow this to your office IP/32 for anything longer than a demo."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "extra_admin_role_arns" {
  description = "Extra IAM role ARNs granted AmazonEKSClusterAdminPolicy through an access entry (typically the GitHub Actions OIDC role agentflow-github-actions created by the bootstrap stack)."
  type        = list(string)
  default     = []
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

variable "profile" {
  description = "Platform catalogue profile: `minimal` (core only) or `full` (everything)."
  type        = string
  default     = "full"

  validation {
    condition     = contains(["minimal", "full"], var.profile)
    error_message = "profile must be either \"minimal\" or \"full\"."
  }
}

variable "db_instance_class" {
  description = "RDS instance class. db.t4g.micro is the cheapest Graviton class (~0.022 USD/h in eu-west-1)."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "PostgreSQL major version. A bare major lets RDS pick the current minor and keeps auto minor upgrades non-breaking."
  type        = string
  default     = "16"
}

variable "db_force_ssl" {
  description = "Sets the rds.force_ssl parameter. true rejects non-TLS connections, which is what POSTGRES_SSL=true in deploy/envs/aws expects."
  type        = bool
  default     = true
}

variable "argocd_namespace" {
  description = "Namespace hosting ArgoCD."
  type        = string
  default     = "argocd"
}

variable "tags" {
  description = "Extra tags merged into the mandatory Project/Env/ManagedBy/Stack set."
  type        = map(string)
  default     = {}
}
