export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireOwnerSession } from '@/lib/guards';
import { DashboardNav } from './DashboardNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const guard = await requireOwnerSession();
  if (!guard.ok) redirect(guard.redirect);

  return (
    <>
      <DashboardNav />
      {children}
    </>
  );
}
