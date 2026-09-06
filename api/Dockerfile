# syntax=docker/dockerfile:1.7
# Build context = repo root (pnpm workspace).
#   docker build -f api/Dockerfile -t agentflow-api:local .

# ---------------------------------------------------------------------------
# Stage 1 : compile the NestJS app and materialise a production node_modules.
# Runs on the builder architecture: the output is plain JS, no native module.
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:20-bookworm-slim AS build

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    HUSKY=0 \
    CI=true
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /repo

# Manifests first so the install layer is cached until a dependency changes.
# The lockfile check reads every workspace manifest, hence the three SPA/api copies.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY api/package.json ./api/
COPY web/dashboard/package.json ./web/dashboard/
COPY web/studio/package.json ./web/studio/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --ignore-scripts --filter @agentflow/api...

COPY api ./api

RUN pnpm --filter @agentflow/api run build

# /out = package.json + pruned production node_modules, ready to copy as-is.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm --filter @agentflow/api deploy --prod --ignore-scripts /out

# ---------------------------------------------------------------------------
# Stage 2 : Python virtualenv for the agent runners (target architecture).
# ---------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS pydeps

COPY api/python/requirements.txt /tmp/requirements.txt
RUN --mount=type=cache,id=pip,target=/root/.cache/pip,sharing=locked \
    python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r /tmp/requirements.txt

# ---------------------------------------------------------------------------
# Stage 3 : runtime. Python base + the node binary, so both runtimes coexist
# without carrying two package managers.
# ---------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

COPY --from=node:20-bookworm-slim /usr/local/bin/node /usr/local/bin/node

# tini reaps the Python child processes; the libs are what the node binary links against.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini ca-certificates libstdc++6 libatomic1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -u 10001 -g root app

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    PYTHON_BIN=/opt/venv/bin/python \
    PYTHON_SCRIPTS_DIR=/app/python \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

COPY --from=pydeps /opt/venv /opt/venv
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/api/dist ./dist
COPY api/python/*.py ./python/

USER 10001
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/src/main.js"]
