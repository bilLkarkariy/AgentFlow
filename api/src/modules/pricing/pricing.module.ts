import { Global, Module } from '@nestjs/common';
import { PricingService } from './pricing.service';

/**
 * Global so any emission point (python client, flow consumer, controllers)
 * can price a run without re-importing the module everywhere.
 */
@Global()
@Module({
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
