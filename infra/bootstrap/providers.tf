########################################################################
# `Stack = bootstrap` is what tells the long-lived resources apart from
# the ephemeral ones (`Stack = aws-demo`) in Cost Explorer and in
# scripts/aws-check-clean.sh.
########################################################################

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "agentflow"
      Env       = "demo"
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}
