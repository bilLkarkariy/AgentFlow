terraform {
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    # Declared (and therefore pinned in .terraform.lock.hcl) even though the
    # bootstrap stack generates no random value today: it keeps the provider
    # set identical to infra/envs/aws-demo, so a lock file refresh in one
    # stack never surprises the other.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
