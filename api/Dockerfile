# Consolidate into builder and runner stages
FROM node:20-alpine AS builder
WORKDIR /app
# Install pnpm and Nest CLI globally
RUN npm install -g pnpm@8.15.0 @nestjs/cli@10.3.0

# Copy monorepo config and API workspace manifest for install
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY api ./api
COPY proto ./proto
WORKDIR /app/api
# Install only API workspace dependencies (including dev for build)
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build

# Runner stage: minimal image with runtime deps
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy API package manifest and install production deps
COPY api/package.json ./package.json
RUN npm install --only=production
# Copy build output
COPY --from=builder /app/api/dist ./dist
COPY proto ./dist/

COPY .env .env

EXPOSE 3000
CMD ["node", "dist/main"]
