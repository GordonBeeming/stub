import { Resend } from 'resend';

interface SendMagicLinkArgs {
  to: string;
  url: string;
  env: { RESEND_API_KEY?: string; RESEND_FROM?: string };
}

// Magic link is valid for 10 minutes. Expiry is enforced server-side
// against magic_tokens.expires_at; the copy below just mirrors the value
// so recipients know it'll stop working soon.
const MAGIC_LINK_TTL_MINUTES = 10;

// Sentinel value used in .dev.vars so forkers don't have to sign up for
// Resend just to run stub locally. Matches the seed in run.sh.
const DEV_FAKE_KEY = 're_dev_fake';

export async function sendMagicLink({ to, url, env }: SendMagicLinkArgs): Promise<void> {
  if (env.RESEND_API_KEY === DEV_FAKE_KEY) {
    // Dev short-circuit: log the link to the server console so you can click
    // it from the terminal. Never triggers in prod — real Resend keys start
    // with `re_` followed by a long random tail, not the literal sentinel.
    console.log(`\n[stub dev] magic link for ${to}:\n  ${url}\n  (expires in ${MAGIC_LINK_TTL_MINUTES} minutes)\n`);
    return;
  }

  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  if (!env.RESEND_FROM) throw new Error('RESEND_FROM is not configured');

  const resend = new Resend(env.RESEND_API_KEY);

  const subject = 'Your stub sign-in link';
  const text = [
    'Click the link below to sign in to stub.',
    '',
    url,
    '',
    `This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes.`,
    'If you did not request this, ignore the email. No account changes have been made.',
  ].join('\n');

  // Email client support for prefers-color-scheme is uneven. Pick brand dark
  // values; modern clients that honour system light will still render, and
  // the high-contrast text stays legible in either case.
  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#1A1A1A;color:#E0E0E0;padding:24px">
<p>Click below to sign in to stub.</p>
<p><a href="${escapeHtml(url)}" style="color:#46CBFF">${escapeHtml(url)}</a></p>
<p style="color:#D1D5DB;font-size:13px">This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes. If you did not request this, ignore the email.</p>
</body></html>`;

  const result = await resend.emails.send({
    from: env.RESEND_FROM,
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend failed: ${result.error.message}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
