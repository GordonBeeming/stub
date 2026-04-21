import type { Metadata } from 'next';

// Marketing routes live under /stub/* on the marketing host. On the app host
// middleware 301s them to gordonbeeming.com/stub — this layout only renders
// if someone accesses /stub/* through the marketing deployment chain.

export const metadata: Metadata = {
  title: 'stub — short links and burn notes, self-hosted on cloudflare',
  description:
    'Open-source, single-tenant short links and client-side-encrypted burn notes that run on your own Cloudflare free tier.',
};

export default function StubMarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
