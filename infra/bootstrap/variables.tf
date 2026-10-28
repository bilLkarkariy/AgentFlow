########################################################################
# `alert_email` is the only required input: everything else has a default
# so `scripts/aws-bootstrap.sh` can run unattended.
########################################################################

variable "region" {
  description = "AWS region hosting the bootstrap stack (state bucket, budgets, OIDC, secret shells)."
  type        = string
  default     = "eu-west-1"
}

variable "alert_email" {
  description = <<-EOT
    Address that receives AWS Budgets and Cost Anomaly Detection alerts.
    AWS sends a confirmation mail for the anomaly subscription: it must be
    accepted once or the alerts stay silent.
  EOT
  type        = string

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", var.alert_email))
    error_message = "alert_email must be a plain e-mail address, e.g. you@example.com."
  }
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to assume the CI role through OIDC."
  type        = string
  default     = "bilLkarkariy/AgentFlow"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repo))
    error_message = "github_repo must look like owner/name."
  }
}

variable "monthly_budget_usd" {
  description = "Hard monthly ceiling for the whole account, in USD. Alerts at 50/80/100 % actual and 100 % forecast."
  type        = number
  default     = 15

  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "monthly_budget_usd must be greater than 0."
  }
}

variable "daily_budget_usd" {
  description = "Daily ceiling, in USD. A demo session costs about 1 USD, so 3 catches a cluster left running overnight."
  type        = number
  default     = 3

  validation {
    condition     = var.daily_budget_usd > 0
    error_message = "daily_budget_usd must be greater than 0."
  }
}

variable "state_bucket_prefix" {
  description = "Prefix of the Terraform state bucket. The account id is appended to keep the name globally unique."
  type        = string
  default     = "agentflow-tfstate"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,40}[a-z0-9]$", var.state_bucket_prefix))
    error_message = "state_bucket_prefix must be a valid S3 bucket name fragment (lowercase, digits, dot, dash)."
  }
}

variable "noncurrent_version_retention_days" {
  description = "Days a superseded state version is kept before S3 expires it."
  type        = number
  default     = 30
}

variable "anomaly_threshold_usd" {
  description = "Absolute daily cost anomaly impact, in USD, above which Cost Anomaly Detection sends a mail."
  type        = number
  default     = 5
}
