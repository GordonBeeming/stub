import type { CSSProperties, ReactNode } from 'react';

interface Props {
  eyebrow: string;
  children: ReactNode;
  as?: 'h1' | 'h2';
}

// Shared title block for auth entry points and dashboard sub-pages.
// The mono eyebrow locks these into the same terminal-style vocabulary the
// dashboard nav and form labels already use; the heading stays sans at a
// modest weight so it reads as a page title without fighting the chrome.
export function SectionTitle({ eyebrow, children, as = 'h2' }: Props) {
  const Tag = as;
  return (
    <div style={wrap}>
      <div style={eyebrowStyle}>{'// '}{eyebrow}</div>
      <Tag style={titleStyle}>{children}</Tag>
    </div>
  );
}

const wrap: CSSProperties = {
  display: 'grid',
  gap: 6,
  margin: '0 0 20px',
};

const eyebrowStyle: CSSProperties = {
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
};

const titleStyle: CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: 'clamp(19px, 2.2vw, 22px)',
  letterSpacing: '-0.01em',
  color: 'var(--text)',
  margin: 0,
};
