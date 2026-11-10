import { randomBytes } from 'crypto';

export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

/**
 * Shared secret between the API and the Python runners it spawns, required by
 * the routes under /internal.
 *
 * The runners are child processes that call back the API of their own pod
 * (API_URL is the loopback address), so a token generated at startup is
 * enough: the pool hands it to them through their environment. Set
 * INTERNAL_TOOLS_TOKEN only if a runner has to reach another API instance.
 */
export const INTERNAL_TOOLS_TOKEN =
  process.env.INTERNAL_TOOLS_TOKEN || randomBytes(32).toString('hex');
