import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { INTERNAL_TOKEN_HEADER, INTERNAL_TOOLS_TOKEN } from '../internal-token';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Lets a request through only if it carries the internal token (see internal-token.ts). */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const header = context.switchToHttp().getRequest<Request>().headers[INTERNAL_TOKEN_HEADER];
    const token = Array.isArray(header) ? header[0] : header;
    // Digests have the same length whatever was sent: the comparison is constant-time.
    if (!token || !timingSafeEqual(digest(token), digest(INTERNAL_TOOLS_TOKEN))) {
      throw new UnauthorizedException('Internal token required');
    }
    return true;
  }
}
