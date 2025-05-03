.
├── README.md
├── api
│   ├── Dockerfile
│   ├── README.md
│   ├── api_structure.md
│   ├── jest-e2e.json
│   ├── jest.config.unit.json
│   ├── k6
│   │   ├── agent_runner_test.js
│   │   └── bench.sh
│   ├── nest-cli.json
│   ├── package.json
│   ├── proto
│   │   └── agent.proto
│   ├── python
│   │   ├── agent_runner.py
│   │   ├── flow_runner.py
│   │   ├── pytest.ini
│   │   ├── requirements.txt
│   │   ├── test_flow_runner.py
│   │   └── tests
│   │       └── test_agent_runner.py
│   ├── src
│   │   ├── common
│   │   │   ├── controllers
│   │   │   │   └── test-error.controller.ts
│   │   │   ├── filters
│   │   │   │   └── all-exceptions.filter.ts
│   │   │   ├── interceptors
│   │   │   │   ├── otel.interceptor.ts
│   │   │   │   └── slack-alert.interceptor.ts
│   │   │   ├── middleware
│   │   │   │   └── request-id.middleware.ts
│   │   │   ├── python
│   │   │   │   ├── agent-python.client.integration.spec.ts
│   │   │   │   ├── agent-python.client.spec.ts
│   │   │   │   └── agent-python.client.ts
│   │   │   └── schemas
│   │   │       └── flow-payload.zod.ts
│   │   ├── controllers
│   │   │   └── health.controller.ts
│   │   ├── docs
│   │   │   └── architecture
│   │   │       └── worker.md
│   │   ├── main.ts
│   │   ├── modules
│   │   │   ├── agent-runtime
│   │   │   │   ├── agent-python-client.service.spec.ts
│   │   │   │   ├── agent-python-client.service.ts
│   │   │   │   ├── agent-runtime.module.ts
│   │   │   │   ├── agent-runtime.service.ts
│   │   │   │   ├── dsl-parser.service.spec.ts
│   │   │   │   ├── dsl-parser.service.ts
│   │   │   │   ├── flow-engine.service.spec.ts
│   │   │   │   ├── flow-engine.service.ts
│   │   │   │   └── python-worker.pool.ts
│   │   │   ├── agents
│   │   │   │   ├── agent.entity.ts
│   │   │   │   ├── agents.controller.ts
│   │   │   │   ├── agents.module.ts
│   │   │   │   ├── agents.service.ts
│   │   │   │   ├── dsl-parser.service.ts
│   │   │   │   ├── dto
│   │   │   │   │   ├── create-agent.dto.ts
│   │   │   │   │   └── create-from-prompt.dto.ts
│   │   │   │   ├── execution.controller.ts
│   │   │   │   ├── flow
│   │   │   │   │   ├── agent-flow-edge.entity.ts
│   │   │   │   │   ├── agent-flow-node.entity.ts
│   │   │   │   │   ├── agent-flow.entity.ts
│   │   │   │   │   ├── flow.controller.spec.ts
│   │   │   │   │   ├── flow.controller.ts
│   │   │   │   │   ├── flow.dto.ts
│   │   │   │   │   ├── flow.gateway.ts
│   │   │   │   │   └── flow.service.ts
│   │   │   │   └── schemas
│   │   │   │       └── agent-dsl.schema.json
│   │   │   ├── app.module.ts
│   │   │   ├── auth-tokens
│   │   │   │   ├── auth-token.entity.ts
│   │   │   │   ├── auth-tokens.module.ts
│   │   │   │   ├── auth-tokens.service.ts
│   │   │   │   └── token-refresh.service.ts
│   │   │   ├── bull-board
│   │   │   │   ├── bull-board.module.ts
│   │   │   │   ├── dlq-alert.service.spec.ts
│   │   │   │   ├── dlq-alert.service.ts
│   │   │   │   ├── dlq-retry.module.ts
│   │   │   │   └── dlq-retry.service.ts
│   │   │   ├── dashboard
│   │   │   │   ├── dashboard.aggregator.service.ts
│   │   │   │   ├── dashboard.controller.ts
│   │   │   │   ├── dashboard.module.ts
│   │   │   │   ├── dashboard.service.ts
│   │   │   │   └── metric.entity.ts
│   │   │   ├── dlq
│   │   │   │   ├── dlq-bull.controller.ts
│   │   │   │   ├── dlq-bull.service.ts
│   │   │   │   └── dlq.module.ts
│   │   │   ├── flow-logs
│   │   │   │   ├── flow-logs.gateway.ts
│   │   │   │   └── flow-logs.module.ts
│   │   │   ├── gmail
│   │   │   │   ├── gmail.controller.ts
│   │   │   │   ├── gmail.module.ts
│   │   │   │   └── gmail.service.ts
│   │   │   ├── health
│   │   │   │   └── health.controller.ts
│   │   │   ├── hubspot
│   │   │   │   ├── dto
│   │   │   │   │   └── create-hubspot-trigger.dto.ts
│   │   │   │   ├── hubspot-credential.entity.ts
│   │   │   │   ├── hubspot-events.processor.ts
│   │   │   │   ├── hubspot-trigger.entity.ts
│   │   │   │   ├── hubspot-triggers.controller.ts
│   │   │   │   ├── hubspot-triggers.service.ts
│   │   │   │   ├── hubspot.controller.ts
│   │   │   │   ├── hubspot.module.ts
│   │   │   │   ├── hubspot.service.ts
│   │   │   │   └── webhook.controller.ts
│   │   │   ├── metrics
│   │   │   │   ├── metrics.controller.ts
│   │   │   │   ├── metrics.e2e-spec.ts
│   │   │   │   ├── metrics.module.ts
│   │   │   │   └── metrics.service.ts
│   │   │   ├── pennylane
│   │   │   │   ├── dto
│   │   │   │   │   └── create-invoice.dto.ts
│   │   │   │   ├── pennylane.controller.ts
│   │   │   │   ├── pennylane.module.ts
│   │   │   │   ├── pennylane.service.spec.ts
│   │   │   │   └── pennylane.service.ts
│   │   │   ├── queues
│   │   │   │   ├── agent-run.processor.spec.ts
│   │   │   │   ├── agent-run.processor.ts
│   │   │   │   ├── agent.controller.spec.ts
│   │   │   │   ├── agent.controller.ts
│   │   │   │   ├── gmail.processor.ts
│   │   │   │   ├── gmail.queue.controller.ts
│   │   │   │   ├── queues.module.ts
│   │   │   │   └── slack-alert.processor.ts
│   │   │   ├── quonto
│   │   │   │   ├── quonto.controller.ts
│   │   │   │   ├── quonto.module.ts
│   │   │   │   ├── quonto.service.spec.ts
│   │   │   │   └── quonto.service.ts
│   │   │   ├── rabbitmq
│   │   │   │   ├── rabbitmq.module.ts
│   │   │   │   └── rabbitmq.service.ts
│   │   │   ├── seed
│   │   │   │   ├── seed.module.ts
│   │   │   │   └── seed.service.ts
│   │   │   ├── slack
│   │   │   │   ├── dto
│   │   │   │   │   └── slack-message.dto.ts
│   │   │   │   ├── slack.controller.ts
│   │   │   │   ├── slack.module.ts
│   │   │   │   ├── slack.service.spec.ts
│   │   │   │   └── slack.service.ts
│   │   │   ├── stripe
│   │   │   │   ├── billing.controller.ts
│   │   │   │   ├── dto
│   │   │   │   │   ├── create-customer.dto.ts
│   │   │   │   │   └── create-portal-session.dto.ts
│   │   │   │   ├── quota-reporter.service.ts
│   │   │   │   ├── stripe.controller.ts
│   │   │   │   ├── stripe.module.ts
│   │   │   │   └── stripe.service.ts
│   │   │   ├── tasks
│   │   │   │   ├── runs.controller.spec.ts
│   │   │   │   ├── runs.controller.ts
│   │   │   │   ├── task-run.entity.ts
│   │   │   │   └── tasks.module.ts
│   │   │   ├── users
│   │   │   │   ├── dto
│   │   │   │   │   ├── create-user.dto.ts
│   │   │   │   │   └── update-user.dto.ts
│   │   │   │   ├── user.entity.ts
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.module.ts
│   │   │   │   └── users.service.ts
│   │   │   └── xero
│   │   │       ├── xero-auth.controller.ts
│   │   │       ├── xero-auth.service.ts
│   │   │       ├── xero-axios.interceptor.spec.ts
│   │   │       ├── xero-axios.interceptor.ts
│   │   │       ├── xero-refresh.service.ts
│   │   │       ├── xero.controller.ts
│   │   │       ├── xero.module.ts
│   │   │       ├── xero.service.getValidAccessToken.spec.ts
│   │   │       ├── xero.service.spec.ts
│   │   │       └── xero.service.ts
│   │   └── otel-sdk.ts
│   ├── test
│   │   ├── app.integration.e2e.spec.ts
│   │   ├── billing.e2e.spec.ts
│   │   ├── dashboard.controller.spec.ts
│   │   ├── dashboard.e2e.spec.ts
│   │   ├── dashboard.service.spec.ts
│   │   ├── dsl-parser.service.spec.ts
│   │   ├── flow-run.e2e.spec.ts
│   │   ├── flow.e2e.spec.ts
│   │   ├── flowlogs.e2e.spec.ts
│   │   ├── pennylane.e2e.spec.ts
│   │   ├── quonto.e2e.spec.ts
│   │   ├── quota-reporter.service.spec.ts
│   │   ├── runs.e2e.spec.ts
│   │   ├── slack.e2e.spec.ts
│   │   ├── stripe.e2e.spec.ts
│   │   ├── users.e2e.spec.ts
│   │   ├── xero-auth.e2e.spec.ts
│   │   └── z.ts
│   ├── tests.md
│   ├── tsconfig.json
│   └── tsconfig.tsbuildinfo
├── api_structure.md
├── charts
├── docker-compose.ci.yml
├── docker-compose.observability.yml
├── docker-compose.yml
├── docs
│   ├── UX.md
│   ├── agents.md
│   ├── communication.md
│   ├── crewDoc
│   │   ├── The Complete Guide to CrewAI_ Building Autonomous.md
│   │   ├── agent.md
│   │   ├── cli.md
│   │   ├── collaboration.md
│   │   ├── concept.md
│   │   ├── crew.md
│   │   ├── flow.md
│   │   ├── knwoledge.md
│   │   ├── list_tools.md
│   │   ├── llm.md
│   │   ├── memory.md
│   │   ├── planning.md
│   │   ├── process.md
│   │   ├── quickstart.md
│   │   ├── task.md
│   │   ├── testing.md
│   │   ├── tool.md
│   │   └── training.md
│   ├── dashboard metrics.md
│   ├── flow-payload.schema.json
│   ├── old-sprints
│   │   ├── sprint0.md
│   │   ├── sprint1.md
│   │   ├── sprint10.md
│   │   ├── sprint2.md
│   │   ├── sprint3.md
│   │   ├── sprint4.md
│   │   ├── sprint5.md
│   │   ├── sprint6.md
│   │   ├── sprint7.md
│   │   ├── sprint8.md
│   │   └── sprint9.md
│   ├── openai_agents.md
│   ├── otel.md
│   ├── pennylane.md
│   ├── quonto.md
│   ├── rfc
│   │   └── agent_dsl_rfc.md
│   ├── slack.md
│   ├── ui
│   │   └── design-system.md
│   └── xero.md
├── features-ideas.md
├── infra
│   ├── README.md
│   ├── docker-compose.yml
│   ├── envs
│   │   ├── local
│   │   │   ├── agentflow-local-config
│   │   │   ├── main.tf
│   │   │   ├── terraform.tfstate
│   │   │   └── terraform.tfstate.backup
│   │   └── staging
│   │       ├── main.tf
│   │       └── variables.tf
│   ├── gitops
│   │   └── applicationset.yaml
│   ├── grafana
│   │   ├── dashboards
│   │   │   └── agent_costs.json
│   │   └── provisioning
│   │       ├── alerting
│   │       │   ├── alerting.yaml
│   │       │   └── rules
│   │       │       └── workspace-cost-alert.yaml
│   │       ├── dashboards
│   │       │   ├── agent_costs.json
│   │       │   ├── dashboards.yaml
│   │       │   └── workspace_costs.json
│   │       ├── datasources
│   │       │   └── datasources.yaml
│   │       └── notifiers
│   │           └── notification_channels.yaml
│   ├── manifests
│   │   ├── app-of-apps.yaml
│   │   ├── apps
│   │   │   ├── agent-runtime-hpa.yaml
│   │   │   ├── keycloak.yaml
│   │   │   ├── prometheus-adapter.yaml
│   │   │   └── vault.yaml
│   │   └── prometheus
│   │       └── prometheus.yml
│   └── modules
│       ├── cluster
│       │   └── outputs.tf
│       └── kind_cluster
│           └── main.tf
├── instruction.md
├── issues
│   ├── sprint10
│   │   └── v2_sprint10.md
│   ├── sprint11
│   │   └── v2_sprint11.md
│   ├── sprint5
│   │   ├── TECH-TASK-agent-runtime-ci.md
│   │   ├── TECH-TASK-agent-runtime-observability.md
│   │   ├── US33.md
│   │   ├── US34-implementation.md
│   │   ├── US34.md
│   │   ├── US35-implementation.md
│   │   ├── US35.md
│   │   ├── US36-implementation.md
│   │   ├── US36.md
│   │   ├── US‑32.md
│   │   └── v2_sprint5.md
│   ├── sprint6
│   │   ├── BUGFIX-logs-truncated.md
│   │   ├── NEW-US-37.md
│   │   ├── TECH-DEBT-fixtures.md
│   │   ├── TECH-TASK-argocd-appset.md
│   │   ├── US37.md
│   │   ├── US38.md
│   │   ├── US39.md
│   │   ├── US40.md
│   │   ├── US41.md
│   │   └── v2_sprint6.md
│   ├── sprint7
│   │   ├── NEW‑US‑42.md
│   │   ├── NEW‑US‑43.md
│   │   ├── NEW‑US‑44.md
│   │   ├── NEW‑US‑45.md
│   │   ├── NEW‑US‑46.md
│   │   ├── NEW‑US‑47.md
│   │   ├── TECH-DEBT-refactor-tests.md
│   │   ├── TECH-TASK-cli-agent-generator.md
│   │   ├── TECH-TASK-helm-bump.md
│   │   └── v2_sprint7.md
│   ├── sprint8
│   │   ├── NEW‑US‑48.md
│   │   ├── NEW‑US‑49.md
│   │   ├── NEW‑US‑50.md
│   │   ├── NEW‑US‑51.md
│   │   ├── NEW‑US‑52.md
│   │   ├── NEW‑US‑53.md
│   │   ├── TECH-DEBT-purge-v1-api.md
│   │   ├── TECH-TASK-logs-loki.md
│   │   ├── TECH-TASK-playwright-image.md
│   │   ├── TECH-TASK-terraform-upgrade.md
│   │   └── v2_sprint8.md
│   └── sprint9
│       └── v2_sprint9.md
├── next.md
├── otel-collector-config.yaml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── prd.md
├── scripts
│   └── start_postgres.sh
├── web
│   ├── README.md
│   ├── dashboard
│   │   ├── Dockerfile
│   │   ├── cypress
│   │   │   ├── e2e
│   │   │   ├── fixtures
│   │   │   └── support
│   │   ├── cypress.config.ts
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── postcss.config.js
│   │   ├── src
│   │   │   ├── App.tsx
│   │   │   ├── api
│   │   │   │   └── dashboard.ts
│   │   │   ├── components
│   │   │   │   ├── DateRangePicker.tsx
│   │   │   │   └── RoiChart.tsx
│   │   │   ├── index.css
│   │   │   ├── main.tsx
│   │   │   ├── pages
│   │   │   │   ├── DLQConsole.tsx
│   │   │   │   └── Dashboard.tsx
│   │   │   └── types.ts
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── package.json
│   ├── studio
│   │   ├── README.md
│   │   ├── designer.md
│   │   ├── index.html
│   │   ├── jest.config.js
│   │   ├── package.json
│   │   ├── playwright.config.ts
│   │   ├── postcss.config.js
│   │   ├── src
│   │   │   ├── components
│   │   │   │   ├── AgentConfigPanel.css
│   │   │   │   ├── AgentConfigPanel.tsx
│   │   │   │   ├── NodeBox.tsx
│   │   │   │   ├── NodeInspector.tsx
│   │   │   │   ├── NodePalette.tsx
│   │   │   │   ├── TestBar.tsx
│   │   │   │   ├── designer
│   │   │   │   │   └── BlockDetailDrawer.tsx
│   │   │   │   ├── home
│   │   │   │   │   ├── EUCompliance.tsx
│   │   │   │   │   ├── HeroCTA.tsx
│   │   │   │   │   ├── MiniKPI.tsx
│   │   │   │   │   ├── RunTimeline.tsx
│   │   │   │   │   └── StepCard.tsx
│   │   │   │   └── shared
│   │   │   │       ├── BaseLayout.tsx
│   │   │   │       ├── DataTable.tsx
│   │   │   │       ├── EmptyState.tsx
│   │   │   │       ├── Modal.tsx
│   │   │   │       ├── Sidebar.tsx
│   │   │   │       ├── StatusPill.tsx
│   │   │   │       ├── Toast.tsx
│   │   │   │       └── Topbar.tsx
│   │   │   ├── entities
│   │   │   │   ├── agent
│   │   │   │   │   └── api.ts
│   │   │   │   ├── block
│   │   │   │   │   └── api.ts
│   │   │   │   ├── hubspot
│   │   │   │   │   └── api.ts
│   │   │   │   └── run
│   │   │   │       ├── api.ts
│   │   │   │       └── hooks.ts
│   │   │   ├── examples
│   │   │   │   └── agent-block.flow.ts
│   │   │   ├── features
│   │   │   │   └── flowLogs
│   │   │   │       ├── LogLine.tsx
│   │   │   │       ├── LogViewer.tsx
│   │   │   │       └── socket.ts
│   │   │   ├── hooks
│   │   │   │   └── useAgentRun.ts
│   │   │   ├── index.css
│   │   │   ├── main.tsx
│   │   │   ├── nodes
│   │   │   │   └── AgentBlockNode
│   │   │   │       ├── AgentBlockNode.stories.tsx
│   │   │   │       ├── AgentBlockNode.test.tsx
│   │   │   │       └── AgentBlockNode.tsx
│   │   │   ├── pages
│   │   │   │   ├── AgentsPage.tsx
│   │   │   │   ├── BillingPage.tsx
│   │   │   │   ├── BlockMarketplacePage.tsx
│   │   │   │   ├── ConnectorsPage.tsx
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── DesignerPage.tsx
│   │   │   │   ├── FlowLogsPage.tsx
│   │   │   │   ├── FlowsPage.tsx
│   │   │   │   ├── HelpPage.tsx
│   │   │   │   ├── HubspotAuthPage.test.tsx
│   │   │   │   ├── HubspotAuthPage.tsx
│   │   │   │   ├── HubspotTriggersPage.tsx
│   │   │   │   ├── MarketplacePage.tsx
│   │   │   │   ├── NotFoundPage.tsx
│   │   │   │   ├── ProfilePage.tsx
│   │   │   │   ├── RunsPage.tsx
│   │   │   │   ├── SettingsPage.tsx
│   │   │   │   ├── TeamPage.tsx
│   │   │   │   ├── TemplatesGalleryPage.tsx
│   │   │   │   └── WorkspaceSettingsPage.tsx
│   │   │   ├── routes
│   │   │   │   └── App.tsx
│   │   │   ├── services
│   │   │   ├── setupTests.ts
│   │   │   ├── shared
│   │   │   │   ├── api
│   │   │   │   │   └── base.ts
│   │   │   │   ├── lib
│   │   │   │   │   └── env.ts
│   │   │   │   └── types
│   │   │   │       ├── agent.ts
│   │   │   │       ├── block.ts
│   │   │   │       ├── flow.ts
│   │   │   │       ├── hubspot.ts
│   │   │   │       ├── log.ts
│   │   │   │       └── run.ts
│   │   │   ├── store
│   │   │   │   └── useFlowStore.ts
│   │   │   └── stories
│   │   │       ├── Button.stories.ts
│   │   │       ├── Button.tsx
│   │   │       ├── Configure.mdx
│   │   │       ├── Header.stories.ts
│   │   │       ├── Header.tsx
│   │   │       ├── Page.stories.ts
│   │   │       ├── Page.tsx
│   │   │       ├── assets
│   │   │       │   ├── accessibility.png
│   │   │       │   ├── accessibility.svg
│   │   │       │   ├── addon-library.png
│   │   │       │   ├── assets.png
│   │   │       │   ├── avif-test-image.avif
│   │   │       │   ├── context.png
│   │   │       │   ├── discord.svg
│   │   │       │   ├── docs.png
│   │   │       │   ├── figma-plugin.png
│   │   │       │   ├── github.svg
│   │   │       │   ├── share.png
│   │   │       │   ├── styling.png
│   │   │       │   ├── testing.png
│   │   │       │   ├── theming.png
│   │   │       │   ├── tutorials.svg
│   │   │       │   └── youtube.svg
│   │   │       ├── button.css
│   │   │       ├── header.css
│   │   │       └── page.css
│   │   ├── tailwind.config.ts
│   │   ├── test-results
│   │   ├── tests
│   │   │   ├── agent-block.e2e.ts
│   │   │   ├── agent-block.e2e.ts-snapshots
│   │   │   │   └── agent-block-node-chromium-darwin.png
│   │   │   ├── hubspot-auth.e2e.ts
│   │   │   └── hubspot-auth.spec.ts
│   │   ├── tsconfig.json
│   │   ├── tsconfig.test.json
│   │   ├── vite.config.ts
│   │   └── vitest.workspace.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── vite.config.ts
└── worker
    ├── Dockerfile
    ├── agentflow_worker.py
    └── requirements.txt

123 directories, 426 files
