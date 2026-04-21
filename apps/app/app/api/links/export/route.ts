export const dynamic = 'force-dynamic';

import { type NextRequest } from 'next/server';
import { getEnv } from '@/lib/cf';
import { requireOwnerApi } from '@/lib/guards';
import { getClicksForLink, listLinksForUser, logAudit } from '@/lib/db';


const EXPORT_LINK_BATCH = 200;
const EXPORT_CLICKS_PER_LINK = 1000;

export async function GET(_request: NextRequest): Promise<Response> {
  const guard = await requireOwnerApi();
  if (!guard.ok) return guard.response;

  const env = getEnv();
  const userId = guard.session.sub;

  // Audit first so an interrupted stream still leaves an export record.
  await logAudit(env.DB, { actor: userId, action: 'link.export' });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        let cursor: number | null = null;
        // Page through links newest-first in batches. Each link emits its own
        // line, followed by its click rows, so a restore can stream-process.
        while (true) {
          const links = await listLinksForUser(env.DB, userId, {
            limit: EXPORT_LINK_BATCH,
            cursor,
          });
          if (links.length === 0) break;

          for (const link of links) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'link', row: link }) + '\n'),
            );
            const clicks = await getClicksForLink(env.DB, link.id, EXPORT_CLICKS_PER_LINK);
            for (const click of clicks) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ type: 'click', row: click }) + '\n'),
              );
            }
          }

          const last = links[links.length - 1];
          if (!last || links.length < EXPORT_LINK_BATCH) break;
          cursor = last.created_at;
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'content-disposition': 'attachment; filename="stub-links.jsonl"',
    },
  });
}
