#!/usr/bin/env bash
set -euo pipefail

# start Postgres container if not running
container=$(docker compose ps --quiet postgres || true)
if [[ -z "$container" ]]; then
  echo "Starting postgres container…"
  docker compose up -d postgres
else
  status=$(docker inspect -f '{{.State.Status}}' "$container")
  if [[ "$status" != "running" ]]; then
    echo "Restarting postgres container…"
    docker start "$container"
  else
    echo "Postgres already running"
  fi
fi

# wait until healthy
until [[ $(docker inspect --format='{{json .State.Health.Status}}' "$container") == "\"healthy\"" ]]; do
  echo "Waiting for postgres to be healthy…"
  sleep 1
  container=$(docker compose ps --quiet postgres)
  [[ -n "$container" ]] || { echo "Container disappeared"; exit 1; }
  health=$(docker inspect --format='{{.State.Health.Status}}' "$container")
  [[ "$health" == "healthy" ]] && break
done

echo "Postgres is ready."
