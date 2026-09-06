########################################################################
# Ephemeral AWS demo on EKS (WP13).
#
# The whole environment exists for the length of a demo and is then
# deleted: about 0.24 USD per hour, ~1 USD for a session. Two commands
# matter.
#
#   make aws-bootstrap    once per AWS account (state bucket, budget,
#                         GitHub OIDC role, the two long-lived secrets)
#   make aws-up           create everything, render deploy/, wait, report
#   make aws-down         delete everything the session created
#   make aws-check-clean  prove that nothing is left behind
#
# `make aws-up` commits to the current branch: the EIP allocations, the
# subnet ids, the sslip.io domain and the IRSA role ARNs are written into
# deploy/ by scripts/aws-render-env.sh, because ArgoCD only ever reads
# Git. See that script's header for why this is deliberate.
########################################################################

AWS_TF_DIR      ?= infra/envs/aws-demo
AWS_CLUSTER     ?= agentflow-demo
AWS_REGION      ?= eu-west-1
AWS_KUBE_CONTEXT ?= agentflow-aws
CAPACITY_TYPE   ?= SPOT
GITOPS_REV      ?= main

# Roughly what the stack bills per hour, used by `make aws-cost` to turn a
# session length into money. EKS 0.10 + 2x t4g.large spot 0.056 + 2 IPv4
# 0.01 + NLB 0.031 + EBS 0.007 + RDS 0.022.
AWS_USD_PER_HOUR ?= 0.24

# `make aws-ui SHOW=1` prints the passwords instead of masking them.
SHOW ?=

export AWS_REGION
export CLUSTER_NAME := $(AWS_CLUSTER)
export KUBE_CONTEXT_AWS := $(AWS_KUBE_CONTEXT)
export TF_DIR := $(AWS_TF_DIR)

# Only export the profile when the operator actually set one: an empty
# AWS_PROFILE makes the CLI look for a profile named "".
ifneq ($(strip $(AWS_PROFILE)),)
export AWS_PROFILE
endif

##@ AWS demo (EKS, ephemeral)

.PHONY: aws-bootstrap
aws-bootstrap: ## One-off per account: state bucket, budget, OIDC role, agentflow/demo/{app,ca}
	@ALERT_EMAIL="$(ALERT_EMAIL)" $(REPO_ROOT)/scripts/aws-bootstrap.sh $(if $(YES),-y,)

.PHONY: aws-up
aws-up: ## Create the EKS demo, render deploy/, wait for ArgoCD, print the URLs
	@CAPACITY_TYPE=$(CAPACITY_TYPE) GITOPS_REV=$(GITOPS_REV) \
		$(REPO_ROOT)/scripts/aws-up.sh $(if $(YES),-y,)

.PHONY: aws-down
aws-down: ## Delete everything this session created, then audit what is left
	@$(REPO_ROOT)/scripts/aws-down.sh $(if $(YES),-y,)

.PHONY: aws-kubeconfig
aws-kubeconfig: ## Write the kubeconfig entry for the demo cluster (context agentflow-aws)
	aws eks update-kubeconfig --region $(AWS_REGION) --name $(AWS_CLUSTER) --alias $(AWS_KUBE_CONTEXT)
	@kubectl --context $(AWS_KUBE_CONTEXT) get nodes

.PHONY: aws-status
aws-status: ## Nodes, ArgoCD Applications, ingress address and the demo domain
	@printf '\n\033[1m== nodes ==\033[0m\n'
	@kubectl --context $(AWS_KUBE_CONTEXT) get nodes -o wide 2>/dev/null \
		|| echo "  cluster unreachable (make aws-kubeconfig)"
	@printf '\n\033[1m== argocd applications ==\033[0m\n'
	@kubectl --context $(AWS_KUBE_CONTEXT) -n $(ARGOCD_NS) get applications.argoproj.io \
		-o custom-columns='NAME:.metadata.name,WAVE:.metadata.annotations.argocd\.argoproj\.io/sync-wave,SYNC:.status.sync.status,HEALTH:.status.health.status' 2>/dev/null \
		|| echo "  no Applications"
	@printf '\n\033[1m== not running ==\033[0m\n'
	@kubectl --context $(AWS_KUBE_CONTEXT) get pods -A \
		--field-selector=status.phase!=Running,status.phase!=Succeeded 2>/dev/null || true
	@printf '\n\033[1m== ingress ==\033[0m\n'
	@kubectl --context $(AWS_KUBE_CONTEXT) -n istio-ingress get svc istio-ingressgateway \
		-o wide 2>/dev/null || echo "  no ingress Service"
	@domain=$$(sed -n 's/^domain=//p' "$$HOME/.agentflow/session" 2>/dev/null | head -1); \
	if [ -n "$$domain" ]; then \
		printf '\n  API        https://api.%s/health\n' "$$domain"; \
		printf '  Studio     https://studio.%s\n' "$$domain"; \
		printf '  Dashboard  https://dashboard.%s\n\n' "$$domain"; \
	else \
		printf '\n  no session file: run `make aws-up` (or read the terraform outputs)\n\n'; \
	fi

.PHONY: aws-ui
aws-ui: ## Port-forward ArgoCD, Grafana, Kiali and Rollouts; print the credentials
	@$(REPO_ROOT)/scripts/aws-ui.sh $(if $(SHOW),--show,)

.PHONY: aws-trust-ca
aws-trust-ca: ## Trust the demo CA on this Mac so https://*.sslip.io stops warning
	@$(REPO_ROOT)/scripts/aws-trust-ca.sh $(if $(REMOVE),--remove,)

.PHONY: aws-render-env
aws-render-env: ## Write the live environment (EIPs, subnets, domain, roles) into deploy/
	@$(REPO_ROOT)/scripts/aws-render-env.sh

.PHONY: aws-render-check
aws-render-check: ## Fail if deploy/ does not match the live environment
	@$(REPO_ROOT)/scripts/aws-render-env.sh --check

.PHONY: aws-check-clean
aws-check-clean: ## Audit the account for leftovers; exit 1 if anything still costs money
	@$(REPO_ROOT)/scripts/aws-check-clean.sh

.PHONY: aws-guard
aws-guard: ## Cheap check: fail if a cluster, LB, RDS or EC2 instance is still up
	@$(REPO_ROOT)/scripts/aws-check-clean.sh --guard

.PHONY: aws-cost
aws-cost: ## Month-to-date cost of Project=agentflow, plus the current session estimate
	@printf '\n\033[1m== month to date, tag Project=agentflow ==\033[0m\n\n'
	@start=$$(date -u +%Y-%m-01); \
	end=$$(date -u -v+1d +%Y-%m-%d 2>/dev/null || date -u -d '+1 day' +%Y-%m-%d); \
	if out=$$(aws ce get-cost-and-usage \
			--region us-east-1 \
			--time-period Start=$$start,End=$$end \
			--granularity MONTHLY \
			--metrics UnblendedCost \
			--filter '{"Tags":{"Key":"Project","Values":["agentflow"],"MatchOptions":["EQUALS"]}}' \
			--group-by Type=DIMENSION,Key=SERVICE \
			--output json 2>/dev/null); then \
		rows=$$(printf '%s' "$$out" | jq -r '.ResultsByTime[0].Groups[]? | "  \(.Keys[0])|\(.Metrics.UnblendedCost.Amount | tonumber | . * 100 | round / 100) \(.Metrics.UnblendedCost.Unit)"' | sort); \
		total=$$(printf '%s' "$$out" | jq -r '.ResultsByTime[0].Total.UnblendedCost.Amount // "0"'); \
		if [ -n "$$rows" ]; then \
			printf '%s\n' "$$rows" | column -t -s'|'; \
			printf '  %-28s %s USD\n' "TOTAL" "$$(awk -v t="$$total" 'BEGIN { printf "%.2f", t }')"; \
		else \
			printf '  nothing billed to Project=agentflow this month yet\n'; \
			printf '  (cost data lags about 24h, and untagged usage never shows up here)\n'; \
		fi; \
	else \
		printf '  Cost Explorer did not answer.\n'; \
		printf '  Enable it once in the Billing console (Cost Explorer > Enable);\n'; \
		printf '  the first data appears about 24h later.\n'; \
	fi
	@printf '\n\033[1m== current session ==\033[0m\n\n'
	@if [ -f "$$HOME/.agentflow/session" ]; then \
		start=$$(sed -n 's/^started_epoch=//p' "$$HOME/.agentflow/session" | head -1); \
		domain=$$(sed -n 's/^domain=//p' "$$HOME/.agentflow/session" | head -1); \
		now=$$(date +%s); \
		mins=$$(( (now - start) / 60 )); \
		cost=$$(awk -v m="$$mins" -v r="$(AWS_USD_PER_HOUR)" 'BEGIN { printf "%.2f", m / 60 * r }'); \
		printf '  domain     %s\n' "$$domain"; \
		printf '  running    %dh%02dm\n' "$$((mins / 60))" "$$((mins % 60))"; \
		printf '  estimate   %s USD  (at %s USD/h)\n\n' "$$cost" "$(AWS_USD_PER_HOUR)"; \
		printf '  \033[31mStill running. `make aws-down` when you are done.\033[0m\n\n'; \
	else \
		printf '  no cluster is running (no ~/.agentflow/session)\n\n'; \
	fi
