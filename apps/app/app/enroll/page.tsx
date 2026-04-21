export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getEnv } from '@/lib/cf';
import { getPasskeysForUser } from '@/lib/db';
import { requireOwnerSession } from '@/lib/guards';
import { EnrollFlow } from './EnrollFlow';


interface EnrollPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EnrollPage({ searchParams }: EnrollPageProps) {
  const guard = await requireOwnerSession();
  if (!guard.ok) redirect(guard.redirect);

  const params = await searchParams;
  const addingMore = params.add === '1';

  // First-time enroll → redirect straight to the dashboard if the owner
  // already has a passkey. Later enrolls (add=1) keep the flow visible.
  const env = getEnv();
  const existing = await getPasskeysForUser(env.DB, guard.session.sub);
  if (existing.length > 0 && !addingMore) redirect('/dashboard');

  return (
    <section style={{ maxWidth: 520 }}>
      <EnrollFlow addingMore={addingMore} />
    </section>
  );
}
