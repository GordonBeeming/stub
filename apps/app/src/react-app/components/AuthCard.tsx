import type { CSSProperties, ReactNode } from 'react';

interface Props {
  maxWidth: number;
  children: ReactNode;
}

// Shared frame for /login and /enroll so both hops through the auth flow
// feel like the same surface. Each page passes its own maxWidth (the form
// on login is narrower than the enroll copy block) but the wrap and panel
// styling are identical.
export function AuthCard({ maxWidth, children }: Props) {
  const card: CSSProperties = {
    width: '100%',
    maxWidth,
    background: 'var(--bg-2)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px 28px',
  };
  return (
    <section style={wrap}>
      <div style={card}>{children}</div>
    </section>
  );
}

const wrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '16px 0 32px',
};
