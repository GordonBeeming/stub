import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface StackGridProps {
  children: ReactNode;
  className?: string;
}

export function StackGrid({ children, className }: StackGridProps) {
  return <div className={cx('ds-stack', className)}>{children}</div>;
}
