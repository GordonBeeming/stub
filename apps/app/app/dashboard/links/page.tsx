export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getEnv, resolveServerOrigin } from '@/lib/cf';
import { requireOwnerSession } from '@/lib/guards';
import { listLinksForUser } from '@/lib/db';
import { LinksList } from '../LinksList';

export default async function LinksPage() {
  const guard = await requireOwnerSession();
  if (!guard.ok) redirect(guard.redirect);

  const env = getEnv();
  const links = await listLinksForUser(env.DB, guard.session.sub, { limit: 200 });
  const siteUrl = await resolveServerOrigin(env);

  return <LinksList initialLinks={links} siteUrl={siteUrl} />;
}
