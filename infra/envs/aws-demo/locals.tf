########################################################################
# Shared values.
########################################################################

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"

  # Local Zones and Wavelength Zones cannot host EKS nodes or RDS.
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

locals {
  # Single source of truth for every pinned version (deploy/versions.yaml),
  # read the same way by infra/envs/local.
  versions = yamldecode(file("${path.module}/../../../deploy/versions.yaml"))

  name                 = "agentflow-demo"
  account_id           = data.aws_caller_identity.current.account_id
  k8s_version          = coalesce(var.kubernetes_version, local.versions.kubernetes.eks_version)
  argocd_chart_version = local.versions.argocd.chart_version

  # Two AZs: the ELB controller refuses to place a public NLB in a single
  # subnet, but every node stays in azs[0] so that no cross-AZ traffic is
  # ever billed.
  azs = slice(data.aws_availability_zones.available.names, 0, 2)

  tags = merge(
    {
      Project   = "agentflow"
      Env       = "demo"
      ManagedBy = "terraform"
      Stack     = "aws-demo"
    },
    var.tags,
  )

  # sslip.io resolves 1-2-3-4.sslip.io to 1.2.3.4, which gives the demo a
  # stable wildcard domain with no Route53 hosted zone (0.50 USD/month) and
  # no DNS propagation wait.
  ingress_domain = "${replace(aws_eip.ingress[0].public_ip, ".", "-")}.sslip.io"

  ami_type = var.node_arch == "arm64" ? "AL2023_ARM_64_STANDARD" : "AL2023_x86_64_STANDARD"

  secret_prefix = "agentflow/demo"
}
