import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface PageHeaderProps {
  brand: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({ brand, meta, className }: PageHeaderProps) {
  return (
    <header className={cx('ds-page-header', className)}>
      <div className="ds-page-header__brand">{brand}</div>
      {meta ? <div className="ds-page-header__meta">{meta}</div> : null}
    </header>
  );
}
