import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface FeatGridProps {
  children: ReactNode;
  className?: string;
}

export function FeatGrid({ children, className }: FeatGridProps) {
  return <div className={cx('ds-feat-grid', className)}>{children}</div>;
}
