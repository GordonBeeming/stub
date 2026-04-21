import type { ReactNode } from 'react';
import { cx } from './cx.js';

export type NameBadgeVariant = 'top' | 'alt' | 'quirky';

export interface NameBadge {
  label: ReactNode;
  variant: NameBadgeVariant;
}

export interface NameRowProps {
  word: ReactNode;
  tld?: ReactNode;
  children: ReactNode;
  badge?: NameBadge;
  featured?: boolean;
  className?: string;
}

export function NameRow({
  word,
  tld,
  children,
  badge,
  featured = false,
  className,
}: NameRowProps) {
  return (
    <div className={cx('ds-name-row', featured && 'ds-name-row--featured', className)}>
      <div className="ds-name-row__word">
        {word}
        {tld ? <span className="ds-name-row__tld">{tld}</span> : null}
      </div>
      <div className="ds-name-row__desc">{children}</div>
      {badge ? (
        <div className={cx('ds-name-row__badge', `ds-name-row__badge--${badge.variant}`)}>
          {badge.label}
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}
