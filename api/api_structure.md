.
├── Dockerfile
├── README.md
├── api_structure.md
├── jest-e2e.json
├── jest.config.unit.json
├── k6
│   ├── agent_runner_test.js
│   └── bench.sh
├── nest-cli.json
├── package.json
├── proto
│   └── agent.proto
├── python
│   ├── agent_runner.py
│   ├── flow_runner.py
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── test_flow_runner.py
│   └── tests
│       └── test_agent_runner.py
├── src
│   ├── common
│   │   ├── controllers
│   │   │   └── test-error.controller.ts
│   │   ├── filters
│   │   │   └── all-exceptions.filter.ts
│   │   ├── interceptors
│   │   │   ├── otel.interceptor.ts
│   │   │   └── slack-alert.interceptor.ts
│   │   ├── middleware
│   │   │   └── request-id.middleware.ts
│   │   ├── python
│   │   │   ├── agent-python.client.integration.spec.ts
│   │   │   ├── agent-python.client.spec.ts
│   │   │   └── agent-python.client.ts
│   │   └── schemas
│   │       └── flow-payload.zod.ts
│   ├── controllers
│   │   └── health.controller.ts
│   ├── docs
│   │   └── architecture
│   │       └── worker.md
│   ├── main.ts
│   ├── modules
│   │   ├── agent-runtime
│   │   │   ├── agent-python-client.service.spec.ts
│   │   │   ├── agent-python-client.service.ts
│   │   │   ├── agent-runtime.module.ts
│   │   │   ├── agent-runtime.service.ts
│   │   │   ├── dsl-parser.service.spec.ts
│   │   │   ├── dsl-parser.service.ts
│   │   │   ├── flow-engine.service.spec.ts
│   │   │   ├── flow-engine.service.ts
│   │   │   └── python-worker.pool.ts
│   │   ├── agents
│   │   │   ├── agent.entity.ts
│   │   │   ├── agents.controller.ts
│   │   │   ├── agents.module.ts
│   │   │   ├── agents.service.ts
│   │   │   ├── dsl-parser.service.ts
│   │   │   ├── dto
│   │   │   │   ├── create-agent.dto.ts
│   │   │   │   └── create-from-prompt.dto.ts
│   │   │   ├── execution.controller.ts
│   │   │   ├── flow
│   │   │   │   ├── agent-flow-edge.entity.ts
│   │   │   │   ├── agent-flow-node.entity.ts
│   │   │   │   ├── agent-flow.entity.ts
│   │   │   │   ├── flow.controller.spec.ts
│   │   │   │   ├── flow.controller.ts
│   │   │   │   ├── flow.dto.ts
│   │   │   │   ├── flow.gateway.ts
│   │   │   │   └── flow.service.ts
│   │   │   └── schemas
│   │   │       └── agent-dsl.schema.json
│   │   ├── app.module.ts
│   │   ├── auth-tokens
│   │   │   ├── auth-token.entity.ts
│   │   │   ├── auth-tokens.module.ts
│   │   │   ├── auth-tokens.service.ts
│   │   │   └── token-refresh.service.ts
│   │   ├── bull-board
│   │   │   ├── bull-board.module.ts
│   │   │   ├── dlq-alert.service.spec.ts
│   │   │   ├── dlq-alert.service.ts
│   │   │   ├── dlq-retry.module.ts
│   │   │   └── dlq-retry.service.ts
│   │   ├── dashboard
│   │   │   ├── dashboard.aggregator.service.ts
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.module.ts
│   │   │   ├── dashboard.service.ts
│   │   │   └── metric.entity.ts
│   │   ├── dlq
│   │   │   ├── dlq-bull.controller.ts
│   │   │   ├── dlq-bull.service.ts
│   │   │   └── dlq.module.ts
│   │   ├── flow-logs
│   │   │   ├── flow-logs.gateway.ts
│   │   │   └── flow-logs.module.ts
│   │   ├── gmail
│   │   │   ├── gmail.controller.ts
│   │   │   ├── gmail.module.ts
│   │   │   └── gmail.service.ts
│   │   ├── health
│   │   │   └── health.controller.ts
│   │   ├── hubspot
│   │   │   ├── dto
│   │   │   │   └── create-hubspot-trigger.dto.ts
│   │   │   ├── hubspot-credential.entity.ts
│   │   │   ├── hubspot-events.processor.ts
│   │   │   ├── hubspot-trigger.entity.ts
│   │   │   ├── hubspot-triggers.controller.ts
│   │   │   ├── hubspot-triggers.service.ts
│   │   │   ├── hubspot.controller.ts
│   │   │   ├── hubspot.module.ts
│   │   │   ├── hubspot.service.ts
│   │   │   └── webhook.controller.ts
│   │   ├── metrics
│   │   │   ├── metrics.controller.ts
│   │   │   ├── metrics.e2e-spec.ts
│   │   │   ├── metrics.module.ts
│   │   │   └── metrics.service.ts
│   │   ├── pennylane
│   │   │   ├── dto
│   │   │   │   └── create-invoice.dto.ts
│   │   │   ├── pennylane.controller.ts
│   │   │   ├── pennylane.module.ts
│   │   │   ├── pennylane.service.spec.ts
│   │   │   └── pennylane.service.ts
│   │   ├── queues
│   │   │   ├── agent-run.processor.spec.ts
│   │   │   ├── agent-run.processor.ts
│   │   │   ├── agent.controller.spec.ts
│   │   │   ├── agent.controller.ts
│   │   │   ├── gmail.processor.ts
│   │   │   ├── gmail.queue.controller.ts
│   │   │   ├── queues.module.ts
│   │   │   └── slack-alert.processor.ts
│   │   ├── quonto
│   │   │   ├── quonto.controller.ts
│   │   │   ├── quonto.module.ts
│   │   │   ├── quonto.service.spec.ts
│   │   │   └── quonto.service.ts
│   │   ├── rabbitmq
│   │   │   ├── rabbitmq.module.ts
│   │   │   └── rabbitmq.service.ts
│   │   ├── seed
│   │   │   ├── seed.module.ts
│   │   │   └── seed.service.ts
│   │   ├── slack
│   │   │   ├── dto
│   │   │   │   └── slack-message.dto.ts
│   │   │   ├── slack.controller.ts
│   │   │   ├── slack.module.ts
│   │   │   ├── slack.service.spec.ts
│   │   │   └── slack.service.ts
│   │   ├── stripe
│   │   │   ├── billing.controller.ts
│   │   │   ├── dto
│   │   │   │   ├── create-customer.dto.ts
│   │   │   │   └── create-portal-session.dto.ts
│   │   │   ├── quota-reporter.service.ts
│   │   │   ├── stripe.controller.ts
│   │   │   ├── stripe.module.ts
│   │   │   └── stripe.service.ts
│   │   ├── tasks
│   │   │   ├── runs.controller.ts
│   │   │   ├── task-run.entity.ts
│   │   │   └── tasks.module.ts
│   │   ├── users
│   │   │   ├── dto
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   └── update-user.dto.ts
│   │   │   ├── user.entity.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.module.ts
│   │   │   └── users.service.ts
│   │   └── xero
│   │       ├── xero-auth.controller.ts
│   │       ├── xero-auth.service.ts
│   │       ├── xero-axios.interceptor.spec.ts
│   │       ├── xero-axios.interceptor.ts
│   │       ├── xero-refresh.service.ts
│   │       ├── xero.controller.ts
│   │       ├── xero.module.ts
│   │       ├── xero.service.getValidAccessToken.spec.ts
│   │       ├── xero.service.spec.ts
│   │       └── xero.service.ts
│   └── otel-sdk.ts
├── test
│   ├── app.integration.e2e.spec.ts
│   ├── billing.e2e.spec.ts
│   ├── dashboard.controller.spec.ts
│   ├── dashboard.e2e.spec.ts
│   ├── dashboard.service.spec.ts
│   ├── dsl-parser.service.spec.ts
│   ├── flow-run.e2e.spec.ts
│   ├── flow.e2e.spec.ts
│   ├── flowlogs.e2e.spec.ts
│   ├── pennylane.e2e.spec.ts
│   ├── quonto.e2e.spec.ts
│   ├── quota-reporter.service.spec.ts
│   ├── slack.e2e.spec.ts
│   ├── stripe.e2e.spec.ts
│   ├── users.e2e.spec.ts
│   ├── xero-auth.e2e.spec.ts
│   └── z.ts
├── tests.md
├── tsconfig.json
└── tsconfig.tsbuildinfo

47 directories, 165 files
