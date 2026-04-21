import { redirect } from 'next/navigation';
import { getEnv } from '@/lib/cf';
import { getSession, ownerEmailMatches } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const env = getEnv();
  const session = await getSession(env);
  if (session && ownerEmailMatches(session.email, env)) {
    redirect('/dashboard');
  }
  redirect('/login');
}
