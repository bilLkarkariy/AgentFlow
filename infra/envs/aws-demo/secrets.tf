########################################################################
# Secrets Manager.
#
# This stack owns the three secrets whose values it generates. The
# bootstrap stack (infra/bootstrap, never destroyed) owns the two that
# outlive a session: agentflow/demo/app (the user's OPENAI_API_KEY) and
# agentflow/demo/ca (the private CA that `make aws-trust-ca` installs).
#
# recovery_window_in_days = 0 everywhere: with the default 30-day window
# a `terraform destroy` followed by an `apply` the next day fails with
# "You can't create this secret because a secret with this name is
# already scheduled for deletion", which would break the whole
# up/down/up demo cycle.
#
# Nothing here is written to disk. random_password values live in the
# Terraform state (S3, SSE-S3 + TLS), which is exactly why the state
# bucket is private and versioned.
########################################################################

########################################################################
# PostgreSQL - consumed by ExternalSecret agentflow-db (property `url`).
########################################################################

resource "aws_secretsmanager_secret" "db" {
  name                    = "${local.secret_prefix}/db"
  description             = "RDS PostgreSQL connection details for the AgentFlow demo"
  recovery_window_in_days = 0

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id

  secret_string = jsonencode({
    username = "agentflow"
    password = random_password.db.result
    host     = module.rds.db_instance_address
    port     = 5432
    dbname   = "agentflow"
    # sslmode=require, not verify-full: the api trusts the RDS CA bundle
    # loosely (ssl.rejectUnauthorized = false) because shipping the
    # rds-ca-rsa2048 bundle into the image is out of scope for the demo.
    url = "postgres://agentflow:${random_password.db.result}@${module.rds.db_instance_address}:5432/agentflow?sslmode=require"
  })
}

########################################################################
# RabbitMQ - in-cluster broker, not a managed service. The password is
# generated here so that the value is identical for the broker chart, the
# api and the worker, and so that it never appears in git.
########################################################################

resource "random_password" "rabbitmq" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "rabbitmq" {
  name                    = "${local.secret_prefix}/rabbitmq"
  description             = "In-cluster RabbitMQ credentials for the AgentFlow demo"
  recovery_window_in_days = 0

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "rabbitmq" {
  secret_id = aws_secretsmanager_secret.rabbitmq.id

  secret_string = jsonencode({
    username = "agentflow"
    password = random_password.rabbitmq.result
    # The trailing "//" is the URL-encoded default vhost "/". Dropping it
    # makes the client connect to a vhost literally named "" and fail
    # with ACCESS_REFUSED.
    url = "amqp://agentflow:${random_password.rabbitmq.result}@agentflow-rabbitmq:5672//"
  })
}

########################################################################
# Grafana - admin credentials. Grafana is anonymous-Viewer for the demo;
# these are for the one moment someone needs to edit a dashboard live.
########################################################################

resource "random_password" "grafana" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "grafana" {
  name                    = "${local.secret_prefix}/grafana"
  description             = "Grafana admin credentials for the AgentFlow demo"
  recovery_window_in_days = 0

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "grafana" {
  secret_id = aws_secretsmanager_secret.grafana.id

  # Key names match what the kube-prometheus-stack chart expects in
  # grafana.admin.existingSecret (userKey/passwordKey default to
  # admin-user / admin-password).
  secret_string = jsonencode({
    admin-user     = "admin"
    admin-password = random_password.grafana.result
  })
}
