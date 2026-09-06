########################################################################
# VPC - public subnets only.
#
# There is no private subnet and no NAT gateway on purpose: a NAT gateway
# costs 0.045 USD/h plus 0.045 USD/GB, which is more than the rest of this
# demo put together (Annexe G, ADR 0002). Nodes therefore sit in public
# subnets with public IPs, protected by the EKS node security group.
# The interview answer to "would you ship this?" is in the README.
#
# Module: terraform-aws-modules/vpc/aws ~> 6.0 (resolves 6.7.x).
# Fallback if 6.x ever becomes unavailable: `~> 5.21` - same input names
# for everything used here except that v5 has no `public_subnet_objects`.
########################################################################

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.0"

  name = local.name
  cidr = "10.42.0.0/16"
  azs  = local.azs

  # /20 = 4091 usable IPs per subnet. VPC CNI prefix delegation hands each
  # node a /28 at a time, so a /24 would run out after a handful of nodes.
  public_subnets = [
    cidrsubnet("10.42.0.0/16", 4, 0), # 10.42.0.0/20
    cidrsubnet("10.42.0.0/16", 4, 1), # 10.42.16.0/20
  ]

  # Nodes need a public IP to reach the EKS control plane, ECR and GHCR
  # without a NAT gateway.
  map_public_ip_on_launch = true
  enable_nat_gateway      = false

  # Required by the in-cluster kubelet and by RDS private DNS.
  enable_dns_hostnames = true
  enable_dns_support   = true

  # The in-tree AWS cloud provider discovers subnets for a LoadBalancer
  # Service through these two tags. Miss them and the NLB stays <pending>.
  public_subnet_tags = {
    "kubernetes.io/role/elb"              = 1
    "kubernetes.io/cluster/${local.name}" = "shared"
  }

  tags = local.tags
}
