import { Injectable } from '@nestjs/common';
import pricing from '../../pricing.json';

export interface ModelRate {
  /** USD per 1000 output tokens. */
  outputPer1k: number;
}

/** Label used when a model is not part of the price list. */
export const UNKNOWN_MODEL = 'other';

@Injectable()
export class PricingService {
  private readonly models: Record<string, ModelRate> = pricing.models;
  private readonly fallback: ModelRate = pricing.default;

  /** The model labels a metric is allowed to carry. */
  knownModels(): string[] {
    return Object.keys(this.models);
  }

  /**
   * Bound the `model` label to the pricing keys so Prometheus cardinality
   * stays flat: exact key, then longest matching prefix
   * (`gpt-4o-2024-08-06` -> `gpt-4o`), else `other`.
   */
  normalizeModel(model?: string | null): string {
    if (!model) return UNKNOWN_MODEL;
    const candidate = model.trim().toLowerCase();
    if (!candidate) return UNKNOWN_MODEL;
    if (this.models[candidate]) return candidate;
    const prefix = Object.keys(this.models)
      .filter(key => candidate.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    return prefix ?? UNKNOWN_MODEL;
  }

  /** USD per 1000 output tokens for a model (falls back to the default rate). */
  rateFor(model?: string | null): number {
    const key = this.normalizeModel(model);
    return (this.models[key] ?? this.fallback).outputPer1k;
  }

  /** Cost in USD of `tokens` output tokens for a model. */
  costFor(model: string | undefined | null, tokens: number): number {
    if (!Number.isFinite(tokens) || tokens <= 0) return 0;
    return (tokens / 1000) * this.rateFor(model);
  }
}
