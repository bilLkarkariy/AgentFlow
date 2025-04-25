# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@8.15.0
COPY api/package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Stage 2: Build the app
FROM node:18-alpine AS builder
RUN npm install -g pnpm@8.15.0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Copy api source into build context
COPY api/. .
RUN pnpm run build

# Stage 3: Prepare production image
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy built files and deps
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main"]
