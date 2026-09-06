########################################################################
# kind cluster for the AgentFlow local platform.
#
# Topology: 1 control-plane (which also carries the host port mappings)
# + `worker_count` workers. Host ports http_port/https_port are forwarded
# to the NodePorts 30080/30443 used by the Istio ingress gateway Service
# (see deploy/platform/istio/gateway/values-local.yaml), so that
# http://<svc>.agentflow.test resolves through /etc/hosts to 127.0.0.1
# and lands on the mesh without any port-forward.
########################################################################

resource "kind_cluster" "this" {
  name            = var.cluster_name
  node_image      = var.node_image
  kubeconfig_path = var.kubeconfig_path
  wait_for_ready  = var.wait_for_ready

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"

      # Let the API server bind on the loopback only; kind picks a free port.
      kubeadm_config_patches = [
        <<-EOT
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
        EOT
      ]

      extra_port_mappings {
        container_port = 30080
        host_port      = var.http_port
        listen_address = "127.0.0.1"
        protocol       = "TCP"
      }

      extra_port_mappings {
        container_port = 30443
        host_port      = var.https_port
        listen_address = "127.0.0.1"
        protocol       = "TCP"
      }
    }

    dynamic "node" {
      for_each = range(var.worker_count)

      content {
        role = "worker"
      }
    }
  }
}
