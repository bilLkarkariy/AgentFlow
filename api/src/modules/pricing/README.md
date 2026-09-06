# Pricing

`src/pricing.json` holds **illustrative** USD prices per 1000 output tokens.
They are order-of-magnitude figures for the demo dashboards
(`agentflow_llm_cost_usd_total`), not a billing source of truth, and they are
not kept in sync with the OpenAI price list.

Shape:

```json
{ "models": { "<model>": { "outputPer1k": 0.01 } }, "default": { "outputPer1k": 0.001 } }
```

`PricingService.normalizeModel()` bounds the `model` Prometheus label to the
keys above (prefix match, else `other`), which keeps the metric cardinality
flat. Only output tokens are priced: the Python runner streams completion
chunks and we approximate one token per chunk, so there is no prompt-token
count to charge.
