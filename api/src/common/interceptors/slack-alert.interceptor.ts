import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Logger } from '@nestjs/common';

@Injectable()
export class SlackAlertInterceptor implements NestInterceptor {
  constructor(
    @InjectQueue('alert-slack')
    private readonly alertQueue: Queue,
  ) {}

  private readonly logger = new Logger(SlackAlertInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      catchError(err => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        if (status < 500) {
          return throwError(() => err);
        }
        const path = req.url;
        const method = req.method;
        const payload = {
          path,
          method,
          errorMessage: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString(),
        };
        this.alertQueue
          .add('slack-alert', payload)
          .catch(e => this.logger.error(`Queue add error: ${e.message}`));
        return throwError(() => err);
      }),
    );
  }
}
