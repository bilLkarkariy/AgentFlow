output "state_bucket" {
  description = "S3 bucket holding the Terraform state of every AgentFlow stack."
  value       = aws_s3_bucket.state.id
}

output "region" {
  description = "Region the bootstrap stack lives in; also the region of the aws-demo stack."
  value       = var.region
}

output "account_id" {
  description = "AWS account id the stack was applied to."
  value       = data.aws_caller_identity.current.account_id
}

output "github_actions_role_arn" {
  description = "Role assumed by GitHub Actions through OIDC. Set it as the `AWS_ROLE_ARN` variable of the `aws-demo` environment."
  value       = aws_iam_role.github_actions.arn
}

output "oidc_provider_arn" {
  description = "GitHub Actions OIDC provider ARN."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "secret_app_arn" {
  description = "Secrets Manager shell for the application environment (values pushed by scripts/aws-bootstrap.sh)."
  value       = aws_secretsmanager_secret.app.arn
}

output "secret_ca_arn" {
  description = "Secrets Manager shell for the private root CA (values pushed by scripts/aws-bootstrap.sh)."
  value       = aws_secretsmanager_secret.ca.arn
}

output "backend_config" {
  description = <<-EOT
    Backend settings shared by every stack. Feed them to `terraform init`
    one -backend-config flag per entry, plus a per-stack `key`:

      terraform -chdir=infra/envs/aws-demo init \
        -backend-config="bucket=<bucket>" \
        -backend-config="region=<region>" \
        -backend-config="key=aws-demo/terraform.tfstate" \
        -backend-config="use_lockfile=true" \
        -backend-config="encrypt=true"

    `use_lockfile=true` is the S3-native lock (Terraform >= 1.11): there is
    no DynamoDB table to create, pay for or clean up.
  EOT

  value = {
    bucket       = aws_s3_bucket.state.id
    region       = var.region
    use_lockfile = "true"
    encrypt      = "true"
  }
}
