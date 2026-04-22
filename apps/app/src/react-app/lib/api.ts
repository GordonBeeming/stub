// Thin fetch wrappers so components don't repeat URL-building + error-handling.
// Worker endpoints always return JSON with either `{ ok: true, ... }` or
// `{ ok: false, error: ... }`; the helpers here flatten that to a success
// value or a thrown Error with the server-provided reason.

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (await res.json()) as T;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return (await res.json()) as T;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === 'string' && body.error.length > 0) return body.error;
  } catch {
    // fall through to the status-based message
  }
  return `request failed (${res.status})`;
}

export interface ConfigResponse {
  turnstileSiteKey: string;
  siteUrl: string;
}

export interface MeResponse {
  ok: true;
  sub: string;
  email: string;
}

export interface StateResponse {
  hasPasskeys: boolean;
}
