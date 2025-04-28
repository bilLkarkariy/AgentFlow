import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { Provider } from './providers.enum';

interface Rate { prompt_rate: number; completion_rate: number; }
type PricingData = Record<Provider, Record<string, Rate>>;

@Injectable()
export class PricingService {
  private pricing: PricingData;
  private readonly logger = new Logger(PricingService.name);

  constructor() {
    const filePath = join(__dirname, 'models_pricing.json');
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      this.pricing = JSON.parse(raw);
      this.logger.log(`Loaded models_pricing.json with ${Object.keys(this.pricing).length} providers`);
    } catch (err) {
      this.logger.error('Failed to load models_pricing.json', err);
      this.pricing = {} as PricingData;
    }
  }

  getRates(provider: Provider, modelName: string): Rate {
    const providerData = this.pricing[provider];
    if (!providerData) {
      throw new Error(`No pricing data for provider ${provider}`);
    }
    const key = modelName.toLowerCase();
    const rates = providerData[key];
    if (!rates) {
      throw new Error(`No pricing for model ${modelName} under provider ${provider}`);
    }
    return rates;
  }
}
