# AgentFlow API

## Xero OAuth Integration

### Routes

- **GET** `/oauth/xero/authorize` : redirige vers la page d'autorisation Xero.
- **GET** `/oauth/xero/callback` : callback pour échanger le code contre des tokens.
- **GET** `/oauth/xero/refresh?tenantId=<tenantId>` : rafraîchit le token d'accès pour le tenant spécifié.
- **GET** `/xero/invoices?tenantId=<tenantId>` : liste les factures Xero du tenant.
- **POST** `/xero/invoices?tenantId=<tenantId>` : crée une nouvelle facture.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the API in development mode
pnpm --filter api run start:dev

# Run database migrations (if applicable)
pnpm --filter api run typeorm migration:run
```

## Environment Variables

Ensure your `.env` file includes:
```dotenv
POSTGRES_URL=postgres://...
REDIS_HOST=localhost
REDIS_PORT=6379

# Xero OAuth
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_REDIRECT_URI=http://localhost:3000/oauth/xero/callback
XERO_SCOPES="openid profile email accounting.transactions accounting.settings offline_access"
XERO_BASE_URL=https://api.xero.com/api.xro/2.0

# Slack Connector
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SIGNING_SECRET=...

# Pennylane Connector
PENNYLANE_API_TOKEN=...
PENNYLANE_CLIENT_SECRET=...

# Quonto Connector
QUONTO_CLIENT_ID=...
QUONTO_CLIENT_SECRET=...
QUONTO_REDIRECT_URI=http://localhost:3000/oauth/quonto/callback
```

## Available Routes

### Xero
- GET `/oauth/xero/authorize`: Redirect to Xero authorization page.
- GET `/oauth/xero/callback`: OAuth callback to exchange code for tokens and persist them.
- GET `/oauth/xero/refresh?tenantId=<tenantId>`: Refresh access token for specified tenant.
- GET `/xero/invoices?tenantId=<tenantId>`: List invoices for the tenant.
- POST `/xero/invoices?tenantId=<tenantId>`: Create a new invoice.

### (Slack, Pennylane, Quonto routes coming soon)

## Documentation

Refer to `docs/xero.md`, `docs/slack.md`, `docs/pennylane.md`, and `docs/quonto.md` for connector-specific guides.
