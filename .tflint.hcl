########################################################################
# tflint, shared by the three Terraform stacks (infra/bootstrap,
# infra/envs/local, infra/envs/aws-demo).
#
# Only the bundled `terraform` ruleset is enabled. The aws ruleset is a
# separate plugin that has to be downloaded and version-pinned on every
# run, and the checks that matter here (public endpoints, unencrypted
# storage, wide security groups) are already covered by `trivy config` in
# .github/workflows/terraform-ci.yml. One scanner per question.
#
# Run it locally with:
#   tflint --init && tflint --chdir=infra/envs/aws-demo --call-module-type=local
########################################################################

config {
  # Only lint the code in this repository. `all` would descend into
  # .terraform/modules and report on terraform-aws-modules, which we do
  # not own and cannot fix.
  call_module_type = "local"
}

plugin "terraform" {
  enabled = true
  # naming conventions, deprecated syntax, unused declarations, missing
  # versions - the rules that keep three stacks looking like one codebase.
  preset = "recommended"
}

# A variable without a type is a runtime surprise.
rule "terraform_typed_variables" {
  enabled = true
}

# Every module call and provider must be version-pinned: a demo that
# cannot be recreated in six months is not a demo.
rule "terraform_required_version" {
  enabled = true
}

rule "terraform_required_providers" {
  enabled = true
}

# Off on purpose: the stacks are small and self-documenting, and a
# description on `variable "region"` adds noise, not information. The
# variables that need one already have it.
rule "terraform_documented_variables" {
  enabled = false
}

rule "terraform_documented_outputs" {
  enabled = false
}
