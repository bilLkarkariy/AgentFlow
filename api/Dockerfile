# Stage 1: build Node app
FROM node:20-alpine AS builder-node
WORKDIR /app
RUN npm install -g pnpm@8.15.0 @nestjs/cli@10.3.0
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY api ./api
WORKDIR /app/api
RUN pnpm install --no-frozen-lockfile --shamefully-hoist
RUN pnpm run build
RUN pnpm prune --prod

# Stage 2: build Python venv
FROM python:3.11-alpine AS builder-python
RUN apk add --no-cache python3-dev libffi-dev openssl-dev build-base
WORKDIR /app-python
COPY api/python/requirements.txt ./requirements.txt
RUN python3 -m venv --copies venv
ENV PATH="/app-python/venv/bin:$PATH"
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Stage 3: runner
FROM node:20-alpine AS runner
WORKDIR /app
COPY .env ./
ENV NODE_ENV=production PATH="/app/venv/bin:$PATH"
# Copy Node app
COPY --from=builder-node /app/api/dist ./dist
COPY --from=builder-node /app/node_modules ./node_modules
COPY --from=builder-node /app/api/package.json ./package.json
# Copy Python venv and code
COPY --from=builder-python /app-python/venv ./venv
RUN ln -sf /app/venv/bin/python3 /app/venv/bin/python
COPY --from=builder-node /app/api/python ./python

EXPOSE 3000
CMD ["node", "dist/main"]
