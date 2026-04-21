export const dynamic = 'force-dynamic';

import { getEnv, resolveServerOrigin } from '@/lib/cf';
import { CreatePanel } from './CreatePanel';

export default async function DashboardPage() {
  const env = getEnv();
  const siteUrl = await resolveServerOrigin(env);
  return <CreatePanel siteUrl={siteUrl} />;
}
