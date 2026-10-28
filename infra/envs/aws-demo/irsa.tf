########################################################################
# IRSA - three roles, written by hand instead of with
# terraform-aws-modules/iam//modules/iam-role-for-service-accounts-eks.
#
# Why not the module: the IAM module went through a v6 rewrite that
# renamed almost every input (`role_name` -> `name`, `oidc_providers` ->
# `oidc_*`, attach_* flags dropped) while most examples online still show
# the v5 names. An OIDC trust policy is 12 lines; owning them here keeps
# the three roles readable, keeps the least-privilege policies visible in
# review, and removes a module that would have to be re-pinned at every
# major bump. The permission boundaries below are the whole point of the
# file, so they should not be hidden behind a module abstraction.
#
# module.eks.oidc_provider     = oidc.eks.<region>.amazonaws.com/id/<hash>
# module.eks.oidc_provider_arn = arn:aws:iam::<acct>:oidc-provider/<above>
########################################################################

locals {
  irsa_roles = {
    eso = {
      role_name       = "${local.name}-eso"
      service_account = "external-secrets:external-secrets"
      description     = "External Secrets Operator - read agentflow/demo/* from Secrets Manager"
    }
    ebs_csi = {
      role_name       = "${local.name}-ebs-csi"
      service_account = "kube-system:ebs-csi-controller-sa"
      description     = "EBS CSI driver controller - manage gp3 volumes for PVCs"
    }
    loki = {
      role_name       = "${local.name}-loki"
      service_account = "observability:loki"
      description     = "Loki - read/write chunks and the ruler prefix in the demo bucket"
    }
  }
}

########################################################################
# Trust policies. `sub` is pinned to the exact namespace/serviceaccount so
# that any other pod in the cluster that steals a projected token cannot
# assume the role; `aud` is pinned to sts.amazonaws.com so a token minted
# for another audience is refused.
########################################################################

data "aws_iam_policy_document" "irsa_assume_role" {
  for_each = local.irsa_roles

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:sub"
      # service_account is already "<namespace>:<name>".
      values = ["system:serviceaccount:${each.value.service_account}"]
    }

    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

########################################################################
# External Secrets Operator
########################################################################

resource "aws_iam_role" "eso" {
  name                 = local.irsa_roles.eso.role_name
  description          = local.irsa_roles.eso.description
  assume_role_policy   = data.aws_iam_policy_document.irsa_assume_role["eso"].json
  max_session_duration = 3600

  tags = local.tags
}

data "aws_iam_policy_document" "eso" {
  statement {
    sid    = "ReadAgentflowDemoSecrets"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
      "secretsmanager:ListSecretVersionIds",
      "secretsmanager:BatchGetSecretValue",
    ]

    # Scoped to this demo's prefix. The trailing -?????? is how Secrets
    # Manager suffixes every secret ARN; without the wildcard the policy
    # matches nothing.
    resources = ["arn:aws:secretsmanager:${var.region}:${local.account_id}:secret:${local.secret_prefix}/*"]
  }
}

resource "aws_iam_role_policy" "eso" {
  name   = "read-agentflow-demo-secrets"
  role   = aws_iam_role.eso.id
  policy = data.aws_iam_policy_document.eso.json
}

########################################################################
# EBS CSI driver
########################################################################

resource "aws_iam_role" "ebs_csi" {
  name                 = local.irsa_roles.ebs_csi.role_name
  description          = local.irsa_roles.ebs_csi.description
  assume_role_policy   = data.aws_iam_policy_document.irsa_assume_role["ebs_csi"].json
  max_session_duration = 3600

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ebs_csi" {
  role = aws_iam_role.ebs_csi.name
  # AWS-managed and kept up to date by AWS; hand-writing the ~20 EC2
  # actions it needs would only create drift at the next driver release.
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}

########################################################################
# Loki
########################################################################

resource "aws_iam_role" "loki" {
  name                 = local.irsa_roles.loki.role_name
  description          = local.irsa_roles.loki.description
  assume_role_policy   = data.aws_iam_policy_document.irsa_assume_role["loki"].json
  max_session_duration = 3600

  tags = local.tags
}

data "aws_iam_policy_document" "loki" {
  statement {
    sid       = "ListDemoBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [aws_s3_bucket.loki.arn]
  }

  statement {
    sid    = "ReadWriteChunks"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts",
    ]

    resources = ["${aws_s3_bucket.loki.arn}/*"]
  }
}

resource "aws_iam_role_policy" "loki" {
  name   = "readwrite-loki-bucket"
  role   = aws_iam_role.loki.id
  policy = data.aws_iam_policy_document.loki.json
}
