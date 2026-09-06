########################################################################
# AgentFlow - ephemeral EKS demo environment (eu-west-1).
#
# Provider pins mirror plan section 5 / Annexe G:
#   aws    6.x  (the vpc >= 6.28 / eks >= 6.59 modules require it)
#   helm   3.x  (attribute syntax for the `kubernetes` block)
#   random      (database / broker / Grafana passwords)
#
# `kubernetes` is deliberately absent: the only object this stack creates
# inside the cluster is the ArgoCD Helm release. No kubernetes_manifest -
# it would need a live API server at plan time and break `terraform plan`
# on a cluster that does not exist yet.
########################################################################

terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
