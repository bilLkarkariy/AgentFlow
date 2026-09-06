########################################################################
# Local kind cluster (WP7).
#
# `make local-up` is the single command that turns an empty laptop into the
# full platform: kind cluster, ArgoCD, and then ArgoCD reconciles
# deploy/platform/bootstrap wave by wave.
########################################################################

LOCAL_TF_DIR   ?= infra/envs/local
LOCAL_PROFILE  ?= full
GITOPS_REV     ?= main
WAIT_TIMEOUT   ?= 1200

# Extra `terraform apply` arguments, e.g.
#   make local-up TF_VARS='-var http_port=8080 -var https_port=8443'
TF_VARS ?=

##@ Local cluster (kind)

.PHONY: check-tools
check-tools: ## Verify the toolchain, the container VM, ports 80/443 and /etc/hosts
	@$(REPO_ROOT)/scripts/check-tools.sh

.PHONY: local-up
local-up: check-tools ## Create the kind cluster, install ArgoCD, wait for every Application
	terraform -chdir=$(LOCAL_TF_DIR) init -upgrade
	terraform -chdir=$(LOCAL_TF_DIR) apply -auto-approve \
		-var 'platform_profile=$(LOCAL_PROFILE)' \
		-var 'gitops_revision=$(GITOPS_REV)' \
		-var 'domain=$(DOMAIN)' \
		$(TF_VARS)
	kind export kubeconfig --name $(KIND_CLUSTER)
	@case '$(DOMAIN)' in *sslip.io|*nip.io) echo 'hosts: $(DOMAIN) resolves via public DNS, skipping /etc/hosts';; *) $(REPO_ROOT)/scripts/hosts-setup.sh;; esac
	$(REPO_ROOT)/scripts/seed-local-secrets.sh
	$(MAKE) local-wait

.PHONY: local-wait
local-wait: ## Block until every ArgoCD Application is Synced and Healthy (20 min cap)
	@WAIT_TIMEOUT=$(WAIT_TIMEOUT) $(REPO_ROOT)/scripts/wait-apps.sh

.PHONY: local-status
local-status: ## Show nodes, ArgoCD Applications and any pod that is not Running
	@kubectl --context $(KUBE_CONTEXT) get nodes -o wide
	@echo
	@kubectl --context $(KUBE_CONTEXT) -n $(ARGOCD_NS) get applications.argoproj.io \
		-o custom-columns='NAME:.metadata.name,WAVE:.metadata.annotations.argocd\.argoproj\.io/sync-wave,SYNC:.status.sync.status,HEALTH:.status.health.status'
	@echo
	@kubectl --context $(KUBE_CONTEXT) get pods -A \
		--field-selector=status.phase!=Running,status.phase!=Succeeded

.PHONY: local-ui
local-ui: ## Print every local URL and the ArgoCD admin password
	@echo
	@echo "  ArgoCD        http://argocd.$(DOMAIN)"
	@echo "  Grafana       http://grafana.$(DOMAIN)"
	@echo "  Kiali         http://kiali.$(DOMAIN)"
	@echo "  Rollouts      http://rollouts.$(DOMAIN)"
	@echo "  Prometheus    http://prometheus.$(DOMAIN)"
	@echo "  Alertmanager  http://alertmanager.$(DOMAIN)"
	@echo "  API           http://api.$(DOMAIN)/health"
	@echo "  Studio        http://studio.$(DOMAIN)"
	@echo "  Dashboard     http://dashboard.$(DOMAIN)"
	@echo
	@echo "  ArgoCD login  admin / admin   (set in deploy/argocd/argocd-values-local.yaml)"
	@echo "  HTTPS uses the private CA agentflow-ca: the browser warning is expected."
	@echo

.PHONY: local-down
local-down: ## Destroy the kind cluster and everything in it
	terraform -chdir=$(LOCAL_TF_DIR) destroy -auto-approve \
		-var 'platform_profile=$(LOCAL_PROFILE)' \
		-var 'gitops_revision=$(GITOPS_REV)' \
		-var 'domain=$(DOMAIN)' \
		$(TF_VARS)
	@echo "The /etc/hosts entry is left in place. Remove it with:"
	@echo "  $(REPO_ROOT)/scripts/hosts-setup.sh --remove"
