export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { getEnv, getExecutionCtx } from '@/lib/cf';
import { getLinkById, recordClick } from '@/lib/db';
import { hashIP } from '@/lib/crypto';
import { clientIP, referrerHost, uaFamily } from '@/lib/links';


interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, ctx: RouteContext): Promise<Response> {
  const env = getEnv();
  const { id } = await ctx.params;

  const link = await getLinkById(env.DB, id);
  if (!link) return notFoundHtml();

  const now = Math.floor(Date.now() / 1000);
  const expired = link.expires_at !== null && link.expires_at < now;
  const exhausted =
    link.max_clicks !== null && link.max_clicks > 0 && link.click_count >= link.max_clicks;

  // Don't distinguish between "never existed", "disabled", "expired", or
  // "over its click cap" — same 410 page. Less signal for anyone probing.
  if (link.disabled === 1 || expired || exhausted) return goneHtml();

  // Gather click meta before redirecting. All values are best-effort — if the
  // header is missing we record null and move on.
  const headers = request.headers;
  const ip = clientIP(headers);
  const ipHash = ip ? await hashIP(ip, env.IP_HASH_SALT) : null;
  const click = {
    linkId: link.id,
    ipHash,
    uaFamily: uaFamily(headers.get('user-agent')),
    referrerHost: referrerHost(headers.get('referer')),
    country: headers.get('cf-ipcountry'),
    clickedAt: now,
  };

  // Redirect first, write second. waitUntil lets the D1 write continue after
  // the 302 ships. If the runtime doesn't expose it (edge-dev outside CF),
  // fall through to an inline await — correctness beats latency.
  const writePromise = recordClick(env.DB, click);
  try {
    const execCtx = getExecutionCtx();
    execCtx.waitUntil(writePromise);
  } catch {
    await writePromise;
  }

  return NextResponse.redirect(link.url, 302);
}

function htmlResponse(status: number, title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · stub</title>
<style>
  :root {
    --bg: #1A1A1A; --bg-2: #222228; --line: #3A3A42;
    --text: #E0E0E0; --text-2: #D1D5DB; --text-3: #9CA3AF;
    --primary: #46CBFF;
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    --font-serif: 'Instrument Serif', Georgia, serif;
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #F8F9FA; --bg-2: #FFFFFF; --line: #D4D7DC;
      --text: #1A1A1A; --text-2: #374151; --text-3: #6B7280;
      --primary: #0063B2;
    }
  }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: var(--font-sans); }
  main { max-width: 520px; margin: 0 auto; padding: 96px 24px; }
  .eyebrow { color: var(--primary); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 24px; }
  h1 { font-family: var(--font-serif); font-weight: 400; font-size: clamp(40px, 6vw, 64px); line-height: 1; letter-spacing: -0.02em; margin: 0 0 24px; }
  p { color: var(--text-2); font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
  code { font-family: var(--font-mono); font-size: 13px; color: var(--text-3); }
  a { color: var(--primary); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--primary) 40%, transparent); }
</style>
</head>
<body>
<main>
  <div class="eyebrow">${status}</div>
  <h1>${title}</h1>
  ${body}
  <p><code>// stub · short links</code></p>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function notFoundHtml(): Response {
  return htmlResponse(
    404,
    'Nothing here',
    `<p>This short link doesn&rsquo;t exist. It may have been mistyped, or it never existed.</p>
     <p><a href="/">Back home</a></p>`,
  );
}

function goneHtml(): Response {
  // Deliberately generic — don't reveal whether the slug ever existed, only
  // that it isn't serving anything right now.
  return htmlResponse(
    410,
    'Link unavailable',
    `<p>This short link isn&rsquo;t serving a destination anymore.</p>
     <p><a href="/">Back home</a></p>`,
  );
}
