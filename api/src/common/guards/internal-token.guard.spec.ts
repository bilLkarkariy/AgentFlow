import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { INTERNAL_TOKEN_HEADER, INTERNAL_TOOLS_TOKEN } from '../internal-token';
import { InternalTokenGuard } from './internal-token.guard';

describe('InternalTokenGuard', () => {
  const guard = new InternalTokenGuard();
  const contextWith = (headers: Record<string, string | string[]>) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

  it('generates a token when none is configured', () => {
    expect(INTERNAL_TOOLS_TOKEN).toMatch(/^[0-9a-f]{64}$/);
  });

  it('lets a request with the token through', () => {
    expect(guard.canActivate(contextWith({ [INTERNAL_TOKEN_HEADER]: INTERNAL_TOOLS_TOKEN }))).toBe(true);
  });

  it.each([
    ['no header', {}],
    ['an empty header', { [INTERNAL_TOKEN_HEADER]: '' }],
    ['a wrong token', { [INTERNAL_TOKEN_HEADER]: 'f'.repeat(64) }],
    ['a prefix of the token', { [INTERNAL_TOKEN_HEADER]: INTERNAL_TOOLS_TOKEN.slice(0, 32) }],
  ])('rejects %s', (_case, headers) => {
    expect(() => guard.canActivate(contextWith(headers))).toThrow(UnauthorizedException);
  });
});
