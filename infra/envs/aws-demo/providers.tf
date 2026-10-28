########################################################################
# Providers.
########################################################################

provider "aws" {
  region = var.region

  # Every resource carries the demo tags, including the ones created deep
  # inside the modules. scripts/aws-check-clean.sh (WP13) hunts leftovers
  # by `Stack=aws-demo`, so this must stay exhaustive.
  default_tags {
    tags = local.tags
  }
}

########################################################################
# hashicorp/helm 3.x takes `kubernetes` as an attribute (it was a nested
# block in 2.x). Credentials come from `aws eks get-token`, so no
# kubeconfig file has to exist before `terraform apply`.
########################################################################

provider "helm" {
  kubernetes = {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec = {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", local.name, "--region", var.region]
    }
  }
}
