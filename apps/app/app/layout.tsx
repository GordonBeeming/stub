import type { Metadata } from 'next';
import { Footer, PageHeader } from '@gordonbeeming/design-system';
import { ThemeToggle } from '@gordonbeeming/design-system/theme-toggle';
import '@gordonbeeming/design-system/fonts';
import '@gordonbeeming/design-system/tokens.css';
import '@gordonbeeming/design-system/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'stub',
  description: 'Short links and client-side-encrypted burn notes.',
};

// Runs synchronously before any React HTML paints. Reads the persisted
// theme choice and sets data-theme on <html> so the correct palette is in
// place at first paint — otherwise the page briefly flashes the default.
const THEME_INIT = `
try {
  var t = localStorage.getItem('stub-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <div className="ds-wrap">
          <PageHeader
            brand={
              <>
                {'// '}
                <b>stub</b>
                {' · short links & burn notes'}
              </>
            }
            meta={
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 16 }}>
                <ThemeToggle />
                <span>v0.1</span>
              </span>
            }
          />
          {children}
          <Footer
            left={<>{'// stub'}</>}
            right={
              <>
                ready<span style={{ color: 'var(--primary)' }}>■</span>
              </>
            }
          />
        </div>
      </body>
    </html>
  );
}
