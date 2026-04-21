import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface NameListProps {
  children: ReactNode;
  className?: string;
}

export function NameList({ children, className }: NameListProps) {
  return <div className={cx('ds-names', className)}>{children}</div>;
}
