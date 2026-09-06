########################################################################
# Charts, values and GitOps manifests (WP5).
#
# `make lint-deploy` is the gate: nothing under deploy/ reaches ArgoCD
# without passing it, and .github/workflows/deploy-validate.yml runs the
# same target. It renders every chart the way ArgoCD will, then validates
# the result against the real Kubernetes and CRD schemas, so a typo fails
# here and not at 3 am in a sync loop.
########################################################################

DEPLOY_DIR      ?= deploy
SERVICE_CHART   ?= $(DEPLOY_DIR)/charts/agentflow-service
INFRA_CHART     ?= $(DEPLOY_DIR)/charts/agentflow-infra
BOOTSTRAP_CHART ?= $(DEPLOY_DIR)/platform/bootstrap
VERSIONS_FILE   ?= $(DEPLOY_DIR)/versions.yaml

# Services rendered by the ApplicationSet, and the two environments.
SERVICES ?= api worker dashboard studio
ENVS     ?= local aws

# Environment used by the single-shot helpers: make template-api ENV=aws
ENV ?= local

# Namespace the workloads land in (never created by these charts).
APP_NS ?= agentflow

# CRD schemas that ship with no OpenAPI in the vanilla Kubernetes bundle:
# Argo Rollouts, Argo CD, Istio, CloudNativePG, Prometheus Operator.
CRD_CATALOG ?= https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json

# -strict rejects unknown fields; CustomResourceDefinition is skipped
# because the bundled CRD schema is meta-schema only and adds nothing.
KUBECONFORM ?= kubeconform -strict -summary -skip CustomResourceDefinition \
	-schema-location default -schema-location '$(CRD_CATALOG)'

##@ Deploy (charts, values, GitOps manifests)

.PHONY: lint-deploy
lint-deploy: lint-charts lint-values lint-gitops lint-platform lint-versions ## Render and validate everything under deploy/
	@printf '\n  deploy/ is valid\n\n'

.PHONY: lint-charts
lint-charts: ## helm lint both charts against every ci/ profile
	@for f in $(SERVICE_CHART)/ci/*.yaml; do \
		printf '  helm lint agentflow-service %s\n' "$$(basename "$$f")"; \
		helm lint $(SERVICE_CHART) -f "$$f" >/dev/null; \
	done
	@for f in $(INFRA_CHART)/ci/*.yaml; do \
		printf '  helm lint agentflow-infra   %s\n' "$$(basename "$$f")"; \
		helm lint $(INFRA_CHART) -f "$$f" >/dev/null; \
	done

.PHONY: lint-values
lint-values: ## Render every service x env and infra x env, then validate the manifests
	@for env in $(ENVS); do \
		for svc in $(SERVICES); do \
			printf '  %-6s %-10s ' "$$env" "$$svc"; \
			helm template agentflow-$$svc $(SERVICE_CHART) -n $(APP_NS) \
				-f $(DEPLOY_DIR)/envs/base/$$svc.yaml \
				-f $(DEPLOY_DIR)/envs/$$env/$$svc.yaml \
				| $(KUBECONFORM); \
		done; \
		printf '  %-6s %-10s ' "$$env" "infra"; \
		helm template agentflow-infra $(INFRA_CHART) -n $(APP_NS) \
			-f $(DEPLOY_DIR)/envs/base/infra.yaml \
			-f $(DEPLOY_DIR)/envs/$$env/infra.yaml \
			| $(KUBECONFORM); \
	done

.PHONY: lint-gitops
lint-gitops: ## Validate the Applications and ApplicationSets of deploy/argocd/envs
	@printf '  argocd manifests '
	@$(KUBECONFORM) $(DEPLOY_DIR)/argocd/envs/*/*.yaml

.PHONY: lint-platform
lint-platform: ## Render the platform catalogue for both environments
	@for env in $(ENVS); do \
		printf '  bootstrap %-6s ' "$$env"; \
		helm template platform-root $(BOOTSTRAP_CHART) -n $(ARGOCD_NS) \
			-f $(BOOTSTRAP_CHART)/values.yaml \
			-f $(BOOTSTRAP_CHART)/values-$$env.yaml \
			| $(KUBECONFORM); \
	done

.PHONY: lint-versions
lint-versions: ## Fail if a pinned chart version drifts from deploy/versions.yaml
	@fail=0; \
	for pair in $$(yq -r '.components[] | select(has("version")) | .name + "=" + (.version | tostring)' $(BOOTSTRAP_CHART)/values.yaml); do \
		name=$${pair%%=*}; pinned=$${pair#*=}; \
		case "$$name" in \
			istio-*|istiod) key='.istio.version' ;; \
			*) key=".$$(printf '%s' "$$name" | tr '-' '_').chart_version" ;; \
		esac; \
		want=$$(yq -r "$$key // \"\"" $(VERSIONS_FILE)); \
		if [ -z "$$want" ]; then \
			printf '  MISSING %-24s %s has no entry in %s\n' "$$name" "$$key" "$(VERSIONS_FILE)"; fail=1; \
		elif [ "$$want" != "$$pinned" ]; then \
			printf '  DRIFT   %-24s bootstrap=%s versions.yaml=%s\n' "$$name" "$$pinned" "$$want"; fail=1; \
		fi; \
	done; \
	want=$$(yq -r '.cloudnative_pg.chart_version' $(VERSIONS_FILE)); \
	for f in $(DEPLOY_DIR)/argocd/envs/*/cnpg-operator.yaml; do \
		pinned=$$(yq -r '.spec.source.targetRevision | tostring' "$$f"); \
		if [ "$$want" != "$$pinned" ]; then \
			printf '  DRIFT   %-24s %s=%s versions.yaml=%s\n' "cloudnative-pg" "$$f" "$$pinned" "$$want"; fail=1; \
		fi; \
	done; \
	if [ "$$fail" -ne 0 ]; then \
		printf '\n  deploy/versions.yaml is the source of truth: fix the pin, not the check.\n\n'; \
		exit 1; \
	fi; \
	printf '  versions       no drift\n'

.PHONY: template-%
template-%: ## Render one service to stdout: make template-api ENV=local (also template-infra)
	@if [ "$*" = "infra" ]; then \
		helm template agentflow-infra $(INFRA_CHART) -n $(APP_NS) \
			-f $(DEPLOY_DIR)/envs/base/infra.yaml \
			-f $(DEPLOY_DIR)/envs/$(ENV)/infra.yaml; \
	else \
		helm template agentflow-$* $(SERVICE_CHART) -n $(APP_NS) \
			-f $(DEPLOY_DIR)/envs/base/$*.yaml \
			-f $(DEPLOY_DIR)/envs/$(ENV)/$*.yaml; \
	fi

.PHONY: diff-envs
diff-envs: ## Show, per service, what aws changes compared with local (merged values)
	@for svc in $(SERVICES) infra; do \
		printf '\n=== %s : local -> aws ===\n' "$$svc"; \
		diff -u \
			<(yq ea '. as $$i ireduce ({}; . * $$i) | ... comments=""' $(DEPLOY_DIR)/envs/base/$$svc.yaml $(DEPLOY_DIR)/envs/local/$$svc.yaml) \
			<(yq ea '. as $$i ireduce ({}; . * $$i) | ... comments=""' $(DEPLOY_DIR)/envs/base/$$svc.yaml $(DEPLOY_DIR)/envs/aws/$$svc.yaml) \
			|| true; \
	done
