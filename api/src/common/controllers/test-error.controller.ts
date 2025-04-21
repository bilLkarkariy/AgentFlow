import { Controller, Get } from '@nestjs/common';

@Controller()
export class TestErrorController {
  @Get('test-error')
  testError(): void {
    throw new Error('Test error from e2e');
  }
}
