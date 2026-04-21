import type { Context, MiddlewareHandler } from 'hono';
import { getSession, ownerEmailMatches } from './auth';
import type { SessionPayload } from './types';

// Hono variables hang off the context under `c.get('session')`; routes declare
// `{ Variables: AuthVars }` so they get a typed session back without a cast.
export interface AuthVars {
  session: SessionPayload;
}

// Middleware form — mount on every /api/* route group that requires the owner
// session. A missing or mis-emailed session returns a flat 401 JSON body
// identical to the Next version, so the client doesn't learn anything about
// which part of the check failed.
export const requireOwner: MiddlewareHandler<{
  Bindings: CloudflareEnv;
  Variables: AuthVars;
}> = async (c, next) => {
  const session = await getSession(c);
  // ownerEmailMatches compares against env.OWNER_EMAIL — the only field it
  // reads, so passing the whole CloudflareEnv is fine.
  if (!session || !ownerEmailMatches(session.email, c.env)) {
    return c.json({ ok: false, error: 'unauthorized' }, 401);
  }
  c.set('session', session);
  await next();
  return;
};

// Imperative variant for non-middleware spots (e.g. a handler that also
// serves unauthenticated responses alongside owner-only branches).
export type GuardResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: Response };

export async function checkOwner(c: Context): Promise<GuardResult> {
  const session = await getSession(c);
  const env = c.env as CloudflareEnv;
  if (!session || !ownerEmailMatches(session.email, env)) {
    return {
      ok: false,
      response: c.json({ ok: false, error: 'unauthorized' }, 401),
    };
  }
  return { ok: true, session };
}
