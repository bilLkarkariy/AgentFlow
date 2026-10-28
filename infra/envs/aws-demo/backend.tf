########################################################################
# Remote state.
#
# Partial configuration on purpose: the bucket name embeds the AWS account
# id, which is not known until `aws sts get-caller-identity` runs. The
# values are supplied by scripts/aws-up.sh (WP13):
#
#   terraform init -reconfigure \
#     -backend-config="bucket=agentflow-tfstate-<account_id>" \
#     -backend-config="key=aws-demo/terraform.tfstate" \
#     -backend-config="region=eu-west-1" \
#     -backend-config="encrypt=true" \
#     -backend-config="use_lockfile=true"
#
# `use_lockfile=true` is the native S3 lock (Terraform >= 1.11); there is
# no DynamoDB table to create, pay for or clean up.
#
# `terraform init -backend=false` (CI: fmt / validate without credentials)
# skips this block entirely.
########################################################################

terraform {
  backend "s3" {}
}
