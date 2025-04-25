# Dockerfile for agent-runtime
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto ./proto
COPY --from=builder /app/jest-e2e.json ./
COPY --from=builder /app/test ./test
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src ./src

EXPOSE 8000
CMD ["node", "dist/main.js"]
