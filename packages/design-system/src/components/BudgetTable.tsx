import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface BudgetTableProps {
  children: ReactNode;
  className?: string;
}

export function BudgetTable({ children, className }: BudgetTableProps) {
  return <div className={cx('ds-budget', className)}>{children}</div>;
}
