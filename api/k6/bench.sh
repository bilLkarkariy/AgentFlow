#!/usr/bin/env bash
for i in {1..50}; do
  curl -s -X POST http://localhost:3000/agents/run \
    -H 'Content-Type: application/json' \
    -d '{"prompt":"Hello"}' &
done
wait
echo "Done."