# Dockerfile for agent-runtime

# ---------- Build Node layer ----------
FROM node:20-alpine AS node-builder
WORKDIR /app
COPY package*.json ./
# Install all dependencies including dev for build
RUN npm install
COPY . .
RUN npm run build

# ---------- Final runtime layer with Python ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy Node build
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package*.json ./
COPY --from=node-builder /app/proto ./proto

# Prepare Python environment and install dependencies
RUN apk add --no-cache python3 py3-pip dumb-init
COPY python/requirements.txt ./python/requirements.txt
RUN python3 -m venv /env && /env/bin/pip install --no-cache-dir -r python/requirements.txt
ENV PATH="/env/bin:$PATH"

# Copy Python bridge source
COPY python ./python

# Expose ports: 8000 for NestJS, 50051 for internal gRPC bridge
EXPOSE 8000 50051

# Start both processes via dumb-init without pm2
CMD ["dumb-init", "sh", "-c", "node dist/main.js & python3 python/bridge.py"]
