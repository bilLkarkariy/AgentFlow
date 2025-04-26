# AgentFlow Infra

Terraform IaC skeleton for staging & prod (Kubernetes, RDS, etc.).

Structure :
```
infra/
  ├── modules/
  ├── envs/
      ├── staging/
      └── prod/
```

## Metrics Stack

Use Docker Compose to provision a local metrics stack (Prometheus, Tempo, Grafana):
```bash
# from infra/ directory
docker-compose up -d
```

After startup:
- Prometheus ↦ http://localhost:9090
- Tempo       ↦ http://localhost:3200
- Grafana     ↦ http://localhost:3000 (admin/admin)

Datasources and dashboards (Agent Costs) are auto-provisioned.
