jest.mock('fs', () => ({ readFileSync: jest.fn() }));
import { PricingService } from './pricing.service';
import { Provider } from './providers.enum';
import * as fs from 'fs';

describe('PricingService', () => {
  const sampleData = {
    openai: { foo: { prompt_rate: 0.1, completion_rate: 0.2 } },
  };
  const sampleJson = JSON.stringify(sampleData);

  beforeEach(() => {
    (fs.readFileSync as jest.Mock).mockReturnValue(sampleJson);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should load pricing data on init', () => {
    const service = new PricingService();
    expect((service as any).pricing).toEqual(sampleData);
  });

  it('should return correct rates for model', () => {
    const service = new PricingService();
    const rates = service.getRates(Provider.OpenAI, 'foo');
    expect(rates).toEqual({ prompt_rate: 0.1, completion_rate: 0.2 });
  });

  it('should throw for unknown provider', () => {
    const service = new PricingService();
    expect(() => service.getRates('invalid' as Provider, 'foo')).toThrow('No pricing data for provider invalid');
  });

  it('should throw for unknown model under valid provider', () => {
    const service = new PricingService();
    expect(() => service.getRates(Provider.OpenAI, 'bar')).toThrow('No pricing for model bar under provider openai');
  });

  it('should handle JSON read errors gracefully', () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => { throw new Error('fail'); });
    const service = new PricingService();
    expect(() => service.getRates(Provider.OpenAI, 'foo')).toThrow();
  });
});
