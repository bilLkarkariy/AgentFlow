########################################################################
# EKS control plane + one managed node group.
#
# Module: terraform-aws-modules/eks/aws ~> 21.0 (resolves 21.25.x).
# v21 renamed most inputs of v20 (`cluster_name` -> `name`,
# `cluster_version` -> `kubernetes_version`, `cluster_endpoint_*` ->
# `endpoint_*`, `cluster_addons` -> `addons`, `cluster_enabled_log_types`
# -> `enabled_log_types`); the names below were checked against
# .terraform/modules/eks/variables.tf at that version.
########################################################################

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.0"

  name               = local.name
  kubernetes_version = local.k8s_version

  # Cost control. Control plane logs go to CloudWatch Logs, which bills
  # ingestion + storage and survives `terraform destroy` unless the log
  # group is managed here. Off, and no group created at all.
  # trivy:ignore:AVD-AWS-0038 demo cluster, torn down after every session; audit logging is a cost, not a control, here
  enabled_log_types           = []
  create_cloudwatch_log_group = false

  # Envelope encryption of Secrets needs a customer managed KMS key
  # (1 USD/month + request charges) that also has to be scheduled for
  # deletion on teardown. `encryption_config = null` disables the feature
  # outright - passing `{}` would still enable it and then fail because
  # create_kms_key = false leaves provider_key_arn null.
  # trivy:ignore:AVD-AWS-0039 no KMS CMK on a cluster that lives ~4h and holds no production secret
  create_kms_key    = false
  encryption_config = null

  # Standard support only. Extended support on an EOL minor silently
  # multiplies the control plane price by 6 (0.10 -> 0.60 USD/h).
  upgrade_policy = {
    support_type = "STANDARD"
  }

  # Access entries, not the deprecated aws-auth ConfigMap.
  authentication_mode                      = "API"
  enable_cluster_creator_admin_permissions = true

  access_entries = {
    for idx, arn in var.extra_admin_role_arns : "admin-${idx}" => {
      principal_arn = arn
      policy_associations = {
        admin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
  }

  # The API server is reachable from the internet: `make aws-up` runs from
  # a laptop with a dynamic IP and there is no bastion. Lock it down with
  # `api_allowed_cidrs = ["<your ip>/32"]` for anything long-lived.
  # trivy:ignore:AVD-AWS-0040 public endpoint is required: no VPN, no bastion, no private subnet in this demo
  # trivy:ignore:AVD-AWS-0041 api_allowed_cidrs narrows this when the user sets it
  endpoint_public_access       = true
  endpoint_private_access      = true
  endpoint_public_access_cidrs = var.api_allowed_cidrs

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.public_subnets
  control_plane_subnet_ids = module.vpc.public_subnets

  addons = {
    coredns    = {}
    kube-proxy = {}

    vpc-cni = {
      # Must exist before the first node joins, otherwise pods stay
      # ContainerCreating until the add-on lands.
      before_compute = true
      configuration_values = jsonencode({
        env = {
          # A t4g.large is capped at 3 ENIs x 12 IPs = 35 pods without
          # prefix delegation. With it, each ENI carries a /28 and the
          # cap rises to 110, which the platform profile needs.
          ENABLE_PREFIX_DELEGATION = "true"
          WARM_PREFIX_TARGET       = "1"
        }
        enableNetworkPolicy = "true"
      })
    }

    aws-ebs-csi-driver = {
      service_account_role_arn = aws_iam_role.ebs_csi.arn
    }

    metrics-server = {}
  }

  eks_managed_node_groups = {
    demo = {
      ami_type       = local.ami_type
      instance_types = var.node_instance_types
      capacity_type  = var.capacity_type

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      # Single AZ. Two AZs would double the EBS footprint and add
      # cross-AZ data transfer for every pod-to-pod hop, for no benefit
      # on a cluster that is destroyed the same day.
      subnet_ids = [module.vpc.public_subnets[0]]

      # 20 GiB is the default and fills up with images (istio-proxy,
      # prometheus, loki, four AgentFlow images) during a demo.
      disk_size = 30

      labels = {
        "agentflow.io/pool" = "demo"
      }
    }
  }

  # The module already tags the node security group with
  # kubernetes.io/cluster/<name> = owned (node_groups.tf), which the
  # in-tree NLB needs; this only adds the demo tags on top.
  node_security_group_tags = local.tags

  tags = local.tags
}
