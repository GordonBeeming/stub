const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export interface TurnstileResult {
  ok: boolean;
  // Cloudflare's error-codes array, surfaced so the caller can log which
  // rule fired. Common codes: `invalid-input-secret` (wrong secret for
  // this site key), `hostname-not-configured` (widget origin isn't on the
  // site's domain list — e.g. localhost missing in dev),
  // `timeout-or-duplicate` (token reused or >5min old). None of these are
  // secret values, so they're safe to include in structured logs.
  errorCodes: string[];
}

export async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
  secret: string,
): Promise<TurnstileResult> {
  if (!token) return { ok: false, errorCodes: ['missing-input-response'] };
  if (!secret) return { ok: false, errorCodes: ['missing-input-secret'] };

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return { ok: false, errorCodes: [`http-${res.status}`] };
    const json = (await res.json()) as SiteVerifyResponse;
    return { ok: json.success === true, errorCodes: json['error-codes'] ?? [] };
  } catch (err) {
    return { ok: false, errorCodes: [err instanceof Error ? err.message : 'fetch-failed'] };
  }
}
