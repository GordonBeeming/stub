import {
  disableExpiredLinks,
  dumpTableJsonl,
  logAudit,
  pruneExpiredMagicTokens,
  pruneExpiredNotes,
  pruneReadBurnedNotes,
} from './db';

// Tables dumped by the nightly backup, in deterministic order so diffs across
// days stay readable. Add new tables here when migrations add them.
const BACKUP_TABLES = ['users', 'passkeys', 'links', 'link_clicks', 'notes', 'audit'] as const;

export interface CronPruneCounts {
  magicTokens: number;
  expiredNotes: number;
  readNotes: number;
  expiredLinks: number;
}

export interface CronBackupResult {
  objectKey: string;
  bytes: number;
}

export interface CronResult {
  pruned: CronPruneCounts;
  backup: CronBackupResult | null;
}

// UTC date stamp (YYYY-MM-DD) — cron runs at 03:00 UTC so the key always lands
// in the same calendar day as the trigger.
function utcDateStamp(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function buildBackupBody(db: D1Database, dumpAt: number): Promise<string> {
  // Leading JSON header line acts as a manifest — restores can sanity-check
  // the tables list before streaming rows.
  const header = JSON.stringify({ dump_at: dumpAt, tables: BACKUP_TABLES });
  const parts: string[] = [header];
  for (const table of BACKUP_TABLES) {
    const body = await dumpTableJsonl(db, table);
    if (body.length > 0) parts.push(body);
  }
  return parts.join('\n') + '\n';
}

export async function runDailyCron(env: CloudflareEnv): Promise<CronResult> {
  const db = env.DB;

  const [magicTokens, expiredNotes, readNotes, expiredLinks] = await Promise.all([
    pruneExpiredMagicTokens(db),
    pruneExpiredNotes(db),
    pruneReadBurnedNotes(db),
    disableExpiredLinks(db),
  ]);

  const pruned: CronPruneCounts = { magicTokens, expiredNotes, readNotes, expiredLinks };

  let backup: CronBackupResult | null = null;

  // R2 is optional — stub runs without it. If no bucket is bound, skip the
  // backup step silently. Prune already ran and the audit entry below still
  // records the run so you can confirm the cron fired.
  if (env.BACKUPS) {
    const bucket = env.BACKUPS;
    const dumpAt = Math.floor(Date.now() / 1000);
    const stamp = utcDateStamp(new Date(dumpAt * 1000));
    const objectKey = `backups/${stamp}/stub.jsonl`;

    try {
      const body = await buildBackupBody(db, dumpAt);
      const bytes = new TextEncoder().encode(body).byteLength;
      // Skip gzip for now: workerd's CompressionStream round-trip adds plumbing
      // the first backup doesn't need. Revisit once dumps get big enough to
      // matter on egress or R2 storage cost.
      await bucket.put(objectKey, body, {
        httpMetadata: { contentType: 'application/x-ndjson' },
        customMetadata: { dumpAt: String(dumpAt) },
      });
      backup = { objectKey, bytes };
    } catch (err) {
      // Record the failure in audit rather than letting the whole cron die —
      // prune counts above are already persisted and worth knowing about.
      await logAudit(db, {
        actor: null,
        action: 'cron.backup.error',
        meta: { error: err instanceof Error ? err.message : String(err), objectKey },
      });
    }
  }

  await logAudit(db, {
    actor: null,
    action: 'cron.daily',
    meta: { pruned, backup },
  });

  return { pruned, backup };
}
