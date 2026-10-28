########################################################################
# AgentFlow AWS bootstrap: the long-lived, once-per-account stack.
#
# It owns the four things that must outlive every `make aws-up` /
# `make aws-down` cycle:
#   1. the S3 bucket holding Terraform state (this stack + aws-demo),
#   2. the cost guardrails (budgets + anomaly detection),
#   3. the GitHub Actions OIDC provider and its IAM role,
#   4. the empty Secrets Manager shells filled by scripts/aws-bootstrap.sh.
#
# `make aws-down` NEVER touches it. See README.md before destroying.
########################################################################

data "aws_caller_identity" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  bucket_name = "${var.state_bucket_prefix}-${local.account_id}"

  # GitHub's OIDC issuer. The audience is fixed by
  # aws-actions/configure-aws-credentials.
  github_oidc_host = "token.actions.githubusercontent.com"
  github_oidc_url  = "https://token.actions.githubusercontent.com"

  # Only these two identities may assume the CI role:
  #   - jobs running in the protected `aws-demo` environment (aws-up/aws-down),
  #   - jobs running on the default branch (aws-guard cron).
  github_allowed_subjects = [
    "repo:${var.github_repo}:environment:aws-demo",
    "repo:${var.github_repo}:ref:refs/heads/main",
  ]
}

########################################################################
# 1. Terraform state bucket
#
# No DynamoDB table: locking uses the S3-native conditional write
# (`use_lockfile = true`, Terraform >= 1.11). Consumers must pass it, see
# the `backend_config` output and infra/bootstrap/README.md.
########################################################################

# Server access logging is off on purpose: it would need a second bucket (and a
# second lifecycle policy) for a bucket that only ever holds two state files, and S3
# data events in CloudTrail already answer "who touched the state".
#trivy:ignore:AVD-AWS-0089
resource "aws_s3_bucket" "state" {
  bucket = local.bucket_name

  # The whole point of this stack. Removing this line is a deliberate,
  # documented act (README.md, "How to destroy").
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = local.bucket_name
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# SSE-S3 (AES256) is deliberate, not an oversight: a customer-managed KMS key
# costs 1 USD/month, a sixth of the whole demo budget, and the state files hold
# no credential (the RDS password lives in Secrets Manager, not in state).
#trivy:ignore:AVD-AWS-0132
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Refuse anything that is not TLS: the bucket is reached from laptops and
# from GitHub runners.
data "aws_iam_policy_document" "state_bucket" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.state.arn,
      "${aws_s3_bucket.state.arn}/*",
    ]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.state]
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-noncurrent-state-versions"
    status = "Enabled"

    # Empty filter = every object in the bucket.
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

########################################################################
# 2. Cost guardrails
#
# Budgets and Cost Anomaly Detection are free. `alert_email` receives a
# confirmation mail for the anomaly subscription that must be accepted.
#
# Both APIs are non-regionalised (they resolve to the us-east-1 global
# endpoint whatever `var.region` says), so no provider alias is needed.
########################################################################

resource "aws_budgets_budget" "monthly" {
  name         = "agentflow-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Fixed so the plan does not drift every day.
  time_period_start = "2024-01-01_00:00"

  dynamic "notification" {
    for_each = [50, 80, 100]

    content {
      comparison_operator        = "GREATER_THAN"
      notification_type          = "ACTUAL"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      subscriber_email_addresses = [var.alert_email]
    }
  }

  # The one that actually saves money: it fires before the spend happens.
  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "FORECASTED"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.alert_email]
  }
}

# A cluster forgotten overnight costs ~6 USD: the daily budget catches it
# the next morning, long before the monthly one moves.
resource "aws_budgets_budget" "daily" {
  name         = "agentflow-daily"
  budget_type  = "COST"
  limit_amount = tostring(var.daily_budget_usd)
  limit_unit   = "USD"
  time_unit    = "DAILY"

  time_period_start = "2024-01-01_00:00"

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.alert_email]
  }
}

resource "aws_ce_anomaly_monitor" "services" {
  name              = "agentflow-service-anomalies"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "services" {
  name      = "agentflow-anomaly-daily"
  frequency = "DAILY"

  monitor_arn_list = [aws_ce_anomaly_monitor.services.arn]

  subscriber {
    type    = "EMAIL"
    address = var.alert_email
  }

  # Mail me only when the absolute impact reaches `anomaly_threshold_usd`;
  # a 0.30 USD blip on a demo account is noise.
  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = [tostring(var.anomaly_threshold_usd)]
    }
  }
}

########################################################################
# 3. GitHub Actions OIDC
#
# No long-lived access key anywhere: the workflows exchange the job's
# OIDC token for a short-lived session on `agentflow-github-actions`.
########################################################################

resource "aws_iam_openid_connect_provider" "github" {
  url             = local.github_oidc_url
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  # Since provider 6.x AWS validates GitHub's certificate against its own
  # trust store, so the thumbprint above is inert. It is kept because the
  # API still returns one and an empty list produces a permanent diff.
  lifecycle {
    ignore_changes = [thumbprint_list]
  }

  tags = {
    Name = "github-actions-oidc"
  }
}

data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    sid     = "GitHubActionsWebIdentity"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.github_oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }

    # A list under StringLike is an OR. Without this condition ANY GitHub
    # repository on the planet could assume the role.
    condition {
      test     = "StringLike"
      variable = "${local.github_oidc_host}:sub"
      values   = local.github_allowed_subjects
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name                 = "agentflow-github-actions"
  description          = "OIDC role assumed by aws-up.yml / aws-down.yml / aws-guard.yml."
  assume_role_policy   = data.aws_iam_policy_document.github_actions_trust.json
  max_session_duration = 7200 # 2 h: `aws-up` takes ~25 min, `aws-down` ~20 min.
}

# DEMO SCOPE. AdministratorAccess because this role creates and destroys a
# whole VPC + EKS + RDS estate, and the point of the exercise is the
# pipeline, not the policy. In production this becomes a permission set
# scoped to the aws-demo stack (talking point: what the least-privilege
# version looks like, and why writing it by hand is the wrong answer -
# generate it from CloudTrail with Access Analyzer).
#
# No trivy check fires on a managed-policy attachment (the AWS checks only read
# inline policy documents), so this stays a comment rather than an ignore: the
# scanner is not the reason the choice is defensible.
resource "aws_iam_role_policy_attachment" "github_actions_admin" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

########################################################################
# 4. Secrets Manager shells
#
# Terraform creates the container, never the value: no secret ever
# reaches a state file or a plan output. scripts/aws-bootstrap.sh pushes
# the values with `aws secretsmanager put-secret-value`.
#
# recovery_window_in_days = 0 so a `terraform destroy` really frees the
# name (the 7-day default would block the next bootstrap).
########################################################################

# Both secrets use the AWS-managed key (aws/secretsmanager): a customer-managed
# key would add 1 USD/month each and buys nothing here, since the same account
# owns the key, the secret and the reader.
#trivy:ignore:AVD-AWS-0098
resource "aws_secretsmanager_secret" "app" {
  name                    = "agentflow/demo/app"
  description             = "Application environment for the AgentFlow demo, JSON object of KEY -> value (from the developer's .env). Consumed by External Secrets -> agentflow-api-secrets."
  recovery_window_in_days = 0
}

#trivy:ignore:AVD-AWS-0098
resource "aws_secretsmanager_secret" "ca" {
  name                    = "agentflow/demo/ca"
  description             = "Private root CA for the demo, JSON {\"tls.crt\", \"tls.key\"}. Consumed by External Secrets -> cert-manager ClusterIssuer agentflow-ca."
  recovery_window_in_days = 0
}
