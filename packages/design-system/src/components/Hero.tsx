import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface HeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  cursor?: boolean;
  tagline?: ReactNode;
  className?: string;
}

export function Hero({ eyebrow, title, cursor = false, tagline, className }: HeroProps) {
  return (
    <div className={cx('ds-hero', className)}>
      {eyebrow ? <span className="ds-hero__eyebrow">{eyebrow}</span> : null}
      <h1 className="ds-hero__title">
        {title}
        {cursor ? (
          <span className="ds-hero__cursor" aria-hidden="true">
            .
          </span>
        ) : null}
      </h1>
      {tagline ? <p className="ds-hero__tagline">{tagline}</p> : null}
    </div>
  );
}
