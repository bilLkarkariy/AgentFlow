########################################################################
# Chicken and egg: this stack creates the bucket that stores its own
# state, so the first apply MUST run on local state.
#
#   1. terraform -chdir=infra/bootstrap init
#      terraform -chdir=infra/bootstrap apply          # local state
#   2. uncomment the block below (or let
#      `scripts/aws-bootstrap.sh --migrate-state` do it for you)
#   3. terraform -chdir=infra/bootstrap init -migrate-state \
#        -backend-config="bucket=$(terraform -chdir=infra/bootstrap output -raw state_bucket)" \
#        -backend-config="region=eu-west-1" \
#        -backend-config="key=bootstrap/terraform.tfstate" \
#        -backend-config="use_lockfile=true" \
#        -backend-config="encrypt=true"
#
# The block stays empty on purpose (partial configuration): the bucket
# name contains the account id, which is not known until apply time and
# must not be hard-coded in a public repo.
########################################################################

# >>> backend-s3 (uncommented by scripts/aws-bootstrap.sh --migrate-state)
# terraform {
#   backend "s3" {}
# }
# <<< backend-s3
