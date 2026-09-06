########################################################################
# AgentFlow - operator entry point.
#
# Targets live in mk/*.mk, one file per domain:
#   mk/local.mk   kind cluster lifecycle          (WP7)
#   mk/deploy.mk  chart and manifest linting      (WP5)
#   mk/aws.mk     EKS demo lifecycle              (WP13)
#   mk/demo.mk    canary / chaos demo scripts     (WP14)
#
# `make` with no argument prints this help.
########################################################################

SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

# Absolute repository root, usable from any target.
REPO_ROOT := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

# Shared defaults; every mk/*.mk may override them with `?=`.
DOMAIN        ?= agentflow.test
KIND_CLUSTER  ?= agentflow-local
KUBE_CONTEXT  ?= kind-$(KIND_CLUSTER)
ARGOCD_NS     ?= argocd
export DOMAIN KUBE_CONTEXT ARGOCD_NS

# Glob include: a work package adds a file, not a line here.
-include mk/*.mk

##@ General

.PHONY: help
help: ## Show this help
	@printf '\nAgentFlow make targets\n\n'
	@awk 'BEGIN { FS = ":.*##" } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_%\/-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)
	@printf '\n'
