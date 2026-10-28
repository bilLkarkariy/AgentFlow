########################################################################
# RDS PostgreSQL.
#
# Module: terraform-aws-modules/rds/aws ~> 6.10 (resolves 6.13.x). It
# declares `aws >= 5.92`, so it composes with the aws 6.x provider that
# the vpc/eks modules force; verified by `terraform init` + `validate`.
#
# The local environment runs CloudNativePG instead. Keeping both is
# deliberate (ADR 0003): CNPG shows operator-managed Postgres, RDS shows
# the managed-service trade-off and forces the TLS path in the api.
#
# The db_subnet_group sits on the public subnets because this VPC has no
# private ones, but `publicly_accessible = false` means the instance only
# gets a private address and the security group below only lets the node
# security group in. It is not reachable from the internet.
########################################################################

resource "random_password" "db" {
  length = 32
  # RDS rejects '/', '@', '"' and spaces in a master password, and the
  # value ends up inside a URL. Alphanumeric removes both problems and
  # 32 chars still gives ~190 bits of entropy.
  special = false
}

resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "PostgreSQL access for the ${local.name} EKS nodes"
  vpc_id      = module.vpc.vpc_id

  tags = merge(local.tags, { Name = "${local.name}-db" })
}

resource "aws_vpc_security_group_ingress_rule" "db_from_nodes" {
  security_group_id = aws_security_group.db.id
  description       = "PostgreSQL from the EKS node security group only"

  referenced_security_group_id = module.eks.node_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.10"

  identifier = "${local.name}-db"

  engine               = "postgres"
  engine_version       = var.db_engine_version
  family               = "postgres${var.db_engine_version}"
  major_engine_version = var.db_engine_version
  instance_class       = var.db_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  # Free, and the only way to satisfy "encryption at rest" without a CMK:
  # this uses the AWS-managed aws/rds key.
  storage_encrypted = true

  db_name  = "agentflow"
  username = "agentflow"
  password = random_password.db.result
  port     = 5432

  # The master password lives in the secret this stack writes
  # (agentflow/demo/db). Letting RDS manage it would create a second,
  # differently shaped secret that ESO would have to special-case.
  manage_master_user_password = false

  multi_az            = false
  publicly_accessible = false

  create_db_subnet_group = true
  subnet_ids             = module.vpc.public_subnets
  vpc_security_group_ids = [aws_security_group.db.id]

  # One day of automated backups keeps the instance restorable within a
  # session; 0 would also disable PITR and the storage snapshot machinery.
  backup_retention_period = 1
  skip_final_snapshot     = true
  deletion_protection     = false
  apply_immediately       = true

  create_db_parameter_group = true
  parameters = [
    {
      name = "rds.force_ssl"
      # Rejects any connection that is not TLS. deploy/envs/aws sets
      # POSTGRES_SSL=true and the URL carries ?sslmode=require to match.
      value        = var.db_force_ssl ? "1" : "0"
      apply_method = "pending-reboot"
    },
  ]

  # Everything below costs money for no demo value.
  performance_insights_enabled    = false
  create_monitoring_role          = false
  monitoring_interval             = 0
  enabled_cloudwatch_logs_exports = []
  create_cloudwatch_log_group     = false

  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true

  tags = local.tags
}
