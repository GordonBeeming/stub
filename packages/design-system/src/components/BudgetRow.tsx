import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface BudgetRowProps {
  svc: ReactNode;
  limit: ReactNode;
  used: ReactNode;
  head?: boolean;
  className?: string;
}

export function BudgetRow({ svc, limit, used, head = false, className }: BudgetRowProps) {
  return (
    <div className={cx('ds-budget-row', head && 'ds-budget-row--head', className)}>
      <div className="ds-budget-row__svc">{svc}</div>
      <div className="ds-budget-row__limit">{limit}</div>
      <div className="ds-budget-row__used">{used}</div>
    </div>
  );
}
