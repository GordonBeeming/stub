import type { ReactNode } from 'react';
import { cx } from './cx.js';

export type FeatVariant = 'primary' | 'alt';

export interface FeatProps {
  title: ReactNode;
  children: ReactNode;
  variant?: FeatVariant;
  className?: string;
}

export function Feat({ title, children, variant = 'primary', className }: FeatProps) {
  return (
    <div className={cx('ds-feat', variant === 'alt' && 'ds-feat--alt', className)}>
      <h3 className="ds-feat__title">{title}</h3>
      <p className="ds-feat__body">{children}</p>
    </div>
  );
}
