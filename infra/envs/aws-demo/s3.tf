########################################################################
# Loki object storage.
#
# The kind environment keeps Loki chunks on a filesystem PVC; on EKS they
# go to S3 through IRSA so that a node loss does not lose the demo's logs
# and so that the interview has something to say about the boundary
# between stateful and stateless components.
#
# The account id keeps the name globally unique without a random suffix,
# so the bucket name is reproducible across `aws-up` / `aws-down` cycles.
########################################################################

resource "aws_s3_bucket" "loki" {
  bucket = "${local.name}-loki-${local.account_id}"

  # `terraform destroy` must not need a manual bucket emptying step, and
  # nothing in here is worth keeping past the session.
  force_destroy = true

  tags = local.tags
}

resource "aws_s3_bucket_public_access_block" "loki" {
  bucket = aws_s3_bucket.loki.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "loki" {
  bucket = aws_s3_bucket.loki.id

  rule {
    apply_server_side_encryption_by_default {
      # SSE-S3. A KMS CMK would add 1 USD/month plus a request charge per
      # chunk write, which on Loki is a lot of requests for no benefit on
      # demo logs.
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "loki" {
  bucket = aws_s3_bucket.loki.id

  versioning_configuration {
    # Loki rewrites and compacts objects constantly; versioning would keep
    # every superseded chunk and the lifecycle rule below could not reach
    # them without an extra noncurrent-version rule.
    status = "Disabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "loki" {
  bucket = aws_s3_bucket.loki.id

  rule {
    id     = "expire-demo-logs"
    status = "Enabled"

    filter {}

    # Matches the 168h retention_period in deploy/platform/loki/values-aws.yaml.
    # Loki's compactor deletes chunks on its own; this is the backstop for
    # a cluster that was destroyed before the compactor caught up.
    expiration {
      days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
