export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getEnv } from '@/lib/cf';
import { LoginForm } from './LoginForm';


export default function LoginPage() {
  const env = getEnv();
  // Suspense boundary covers useSearchParams inside the client child —
  // Next 15 requires it when the param hook is read during render.
  return (
    <section style={{ maxWidth: 420 }}>
      <Suspense fallback={null}>
        <LoginForm turnstileSiteKey={env.TURNSTILE_SITE_KEY} />
      </Suspense>
    </section>
  );
}
