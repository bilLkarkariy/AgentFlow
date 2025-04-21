import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PennylaneService } from './pennylane.service';
import { PennylaneController } from './pennylane.controller';

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.PENNYLANE_BASE_URL || 'https://app.pennylane.com/',
    }),
  ],
  providers: [PennylaneService],
  controllers: [PennylaneController],
  exports: [PennylaneService],
})
export class PennylaneModule {}
