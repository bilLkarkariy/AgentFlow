########################################################################
# Outputs.
#
# CONTRACT with WP13 (scripts/aws-up.sh, aws-render-env.sh, aws-down.sh,
# aws-check-clean.sh). These names are read by `terraform output -json`;
# renaming one breaks the lifecycle scripts, so treat them as an API.
########################################################################

output "region" {
  description = "AWS region every resource lives in."
  value       = var.region
}

output "account_id" {
  description = "AWS account id. Used to build the state bucket name and the ClusterSecretStore ARNs."
  value       = local.account_id
}

output "cluster_name" {
  description = "EKS cluster name."
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "Kubernetes API server endpoint."
  value       = module.eks.cluster_endpoint
}

output "kubeconfig_command" {
  description = "Command that writes a kubeconfig context for this cluster."
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "ingress_ips" {
  description = "Public IPs of the ingress Elastic IPs, in the order the NLB expects them."
  value       = aws_eip.ingress[*].public_ip
}

output "ingress_domain" {
  description = "Wildcard demo domain derived from the first ingress EIP (global.domain)."
  value       = local.ingress_domain
}

output "ingress_eip_allocation_ids" {
  description = "EIP allocation ids for service.beta.kubernetes.io/aws-load-balancer-eip-allocations. One per public subnet, same order."
  value       = aws_eip.ingress[*].id
}

output "public_subnet_ids" {
  description = "Public subnet ids for service.beta.kubernetes.io/aws-load-balancer-subnets."
  value       = module.vpc.public_subnets
}

output "urls" {
  description = "Internet-facing application URLs. Admin UIs are reached through `make aws-ui` (port-forward), not through the gateway."
  value = {
    for svc in ["api", "studio", "dashboard"] :
    svc => "https://${svc}.${local.ingress_domain}"
  }
}

output "rds_endpoint" {
  description = "RDS endpoint (host:port). The full URL, with the password, is only in Secrets Manager."
  value       = module.rds.db_instance_endpoint
}

output "eso_role_arn" {
  description = "IRSA role for external-secrets:external-secrets. Substituted into deploy/platform/external-secrets/values-aws.yaml."
  value       = aws_iam_role.eso.arn
}

output "loki_role_arn" {
  description = "IRSA role for observability:loki. Substituted into deploy/platform/loki/values-aws.yaml."
  value       = aws_iam_role.loki.arn
}

output "loki_bucket" {
  description = "S3 bucket holding Loki chunks and rules."
  value       = aws_s3_bucket.loki.id
}

output "ebs_csi_role_arn" {
  description = "IRSA role for kube-system:ebs-csi-controller-sa. Already wired into the add-on; exported for troubleshooting."
  value       = aws_iam_role.ebs_csi.arn
}

output "node_group_name" {
  description = "Managed node group name, for `aws eks describe-nodegroup` in the runbook."
  # node_group_id is "<cluster>:<nodegroup>"; the scripts want the second half.
  value = one([for k, v in module.eks.eks_managed_node_groups : split(":", v.node_group_id)[1]])
}

output "db_secret_arn" {
  description = "Secrets Manager ARN of agentflow/demo/db."
  value       = aws_secretsmanager_secret.db.arn
}

output "rabbitmq_secret_arn" {
  description = "Secrets Manager ARN of agentflow/demo/rabbitmq."
  value       = aws_secretsmanager_secret.rabbitmq.arn
}

output "grafana_secret_arn" {
  description = "Secrets Manager ARN of agentflow/demo/grafana."
  value       = aws_secretsmanager_secret.grafana.arn
}
