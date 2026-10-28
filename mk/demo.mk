########################################################################
# Canary and chaos demo (WP14).
#
# The three targets below are the whole progressive-delivery story:
#
#   make demo-canary TAG=sha-1a2b3c4   a good build is promoted 10 -> 50 -> 100 %
#   make demo-break  TAG=sha-1a2b3c4   the same build with 30 % 5xx: rolled back
#   make demo-fix                      remove the fault, redeploy, watch it heal
#
# None of them applies anything to the cluster. They edit
# deploy/envs/<env>/api.yaml, commit, push, and watch Argo CD and Argo
# Rollouts do the work. `make demo-canary` with no cluster is therefore
# useless but harmless; add DEMO_ARGS='--dry-run' to see the sequence.
########################################################################

# local (kind) or aws (EKS). `make demo-canary DEMO_ENV=aws TAG=...`
DEMO_ENV    ?= local
DEMO_VALUES ?= deploy/envs/$(DEMO_ENV)/api.yaml

# Extra flags handed to scripts/demo-canary.sh, e.g.
#   make demo-canary TAG=sha-1a2b3c4 DEMO_ARGS='--dry-run --no-push'
DEMO_ARGS ?=

# The tag Git currently describes for this environment. Recursively expanded
# so `yq` only runs when a target actually needs it.
CURRENT_TAG = $(shell yq -r '.image.tag // ""' $(DEMO_VALUES) 2>/dev/null)

# `make demo-canary TAG=sha-1a2b3c4` wins; otherwise reuse the tag already in
# the values file (which is what `make demo-fix` needs). TAG is deliberately
# NOT given a global default here: mk/local.mk passes the same variable to
# scripts/local-images.sh, which has its own git-based fallback.
DEMO_TAG = $(or $(TAG),$(CURRENT_TAG))

# Load generator defaults; scripts/loadgen.sh reads these from the environment.
LOADGEN_DURATION ?= 15m
LOADGEN_QPS      ?= 20
LOADGEN_PATH     ?= /agents
LOADGEN_URL      ?= http://127.0.0.1
LOADGEN_HOST     ?= api.$(DOMAIN)
export LOADGEN_DURATION LOADGEN_QPS LOADGEN_PATH LOADGEN_URL LOADGEN_HOST

define require_tag
	@test -n '$(DEMO_TAG)' || { \
		printf 'TAG is required and %s has none.\n  make %s TAG=sha-1a2b3c4\n' \
			'$(DEMO_VALUES)' '$@'; exit 2; }
endef

##@ Demo (canary, chaos, load)

.PHONY: demo-canary
demo-canary: ## Deploy TAG through the canary and watch it (make demo-canary TAG=sha-1a2b3c4)
	$(require_tag)
	@$(REPO_ROOT)/scripts/demo-canary.sh '$(DEMO_TAG)' \
		--env '$(DEMO_ENV)' --values '$(DEMO_VALUES)' $(DEMO_ARGS)

.PHONY: demo-break
demo-break: ## Same deploy with CHAOS_ERROR_RATE=0.3: the AnalysisRun aborts it
	$(require_tag)
	@$(REPO_ROOT)/scripts/demo-canary.sh '$(DEMO_TAG)' --chaos \
		--env '$(DEMO_ENV)' --values '$(DEMO_VALUES)' $(DEMO_ARGS)

.PHONY: demo-fix
demo-fix: ## Remove CHAOS_ERROR_RATE, commit, and watch the canary succeed
	$(require_tag)
	@$(REPO_ROOT)/scripts/demo-canary.sh '$(DEMO_TAG)' \
		--env '$(DEMO_ENV)' --values '$(DEMO_VALUES)' $(DEMO_ARGS)

.PHONY: loadgen
loadgen: ## Send steady traffic through the gateway (hey, or a curl loop)
	@$(REPO_ROOT)/scripts/loadgen.sh \
		--host '$(LOADGEN_HOST)' --url '$(LOADGEN_URL)' \
		--duration '$(LOADGEN_DURATION)' --qps '$(LOADGEN_QPS)' \
		--path '$(LOADGEN_PATH)'

.PHONY: loadgen-k6
loadgen-k6: ## Same traffic with k6 and SLO thresholds (p95 < 800 ms, errors < 5 %)
	@k6 run -e HOST='$(LOADGEN_HOST)' -e BASE_URL='$(LOADGEN_URL)' \
		-e REQUEST_PATH='$(LOADGEN_PATH)' \
		$(REPO_ROOT)/scripts/k6/gateway-load.js

.PHONY: demo-tag
demo-tag: ## Print the image tag Git currently describes for DEMO_ENV
	@printf '%s %s\n' '$(DEMO_VALUES)' '$(CURRENT_TAG)'
