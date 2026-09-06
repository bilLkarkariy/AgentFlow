########################################################################
# Ingress Elastic IPs.
#
# The in-tree AWS cloud provider needs exactly one EIP allocation per
# subnet the NLB is placed in. Two public subnets -> two EIPs. A mismatch
# is the classic failure mode: the Service stays <pending> forever with
# no useful event.
#
# They are allocated here, before the cluster exists, because the demo
# domain is derived from the first one and has to be known at the moment
# ArgoCD is installed (global.domain). Allocating them from the LB
# controller instead would make the domain change on every `aws-up`.
#
# An unassociated EIP costs 0.005 USD/h. aws-check-clean.sh (WP13) fails
# if either survives a teardown.
########################################################################

resource "aws_eip" "ingress" {
  count = 2

  domain = "vpc"

  tags = merge(local.tags, {
    Name = "${local.name}-ingress-${count.index}"
    # Read back by scripts/aws-check-clean.sh.
    "agentflow.io/role" = "ingress"
  })
}
