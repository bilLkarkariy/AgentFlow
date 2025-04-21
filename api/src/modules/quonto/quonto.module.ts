import { Module } from '@nestjs/common';
import { QuontoService } from './quonto.service';
import { QuontoController } from './quonto.controller';

@Module({
  providers: [QuontoService],
  controllers: [QuontoController],
  exports: [QuontoService],
})
export class QuontoModule {}
