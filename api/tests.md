# Tests Summary

## Unit Tests

- **SlackService**
  - `postMessage` sends messages via WebClient.chat.postMessage ✅
  - `getMessages` fetches history via WebClient.conversations.history ✅

- **PennylaneService**
  - `listInvoices` calls axios.get with correct URL & headers ✅

- **DslParserService**
  - parses a valid French prompt ✅
  - throws on unrecognised prompt ✅

- **QuotaReporterService**
  - aggregates usage correctly ✅
  - no record when no runs ✅
  - handles large volumes ✅

- **ExecuteProcessor**
  - saves a TaskRun per job execution ✅
  - still saves even for unsupported DSL ✅

## Integration / E2E Tests

- **AppModule**  
  - `GET /health` returns `{ status: 'ok' }` ✅

- **AgentsModule**  
  - `POST /agents/from-prompt` returns generated agents ✅

- **StripeModule**  
  - `POST /stripe/customer` returns new customer ID ✅

- **SlackModule**  
  - `POST /slack/message` posts to channel & returns `ok: true` ✅
  - `GET /slack/messages` retrieves posted messages ✅

## What’s Done

- Jest configured for unit and E2E (`jest-e2e.json`).
- In-memory SQLite for tests; enabled graceful shutdown hooks.
- Added service & parser unit tests and E2E for agents, app, stripe, slack.

## Missing / To Do

- **XeroService** unit tests (list/create invoices).
- **XeroController** E2E tests for `/xero` endpoints.
- **PennylaneController** E2E tests.
- **Quonto** integration tests.
- Edge-case/error handling tests (invalid input, auth failures).
- Remove Jest warning: `testEnvironmentVars` not supported.
- CI pipeline (e.g. GitHub Actions) for automated testing.
