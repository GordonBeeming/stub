import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface StackCellProps {
  svc: ReactNode;
  role: ReactNode;
  usage: ReactNode;
  className?: string;
}

export function StackCell({ svc, role, usage, className }: StackCellProps) {
  return (
    <div className={cx('ds-stack-cell', className)}>
      <div className="ds-stack-cell__svc">{svc}</div>
      <div className="ds-stack-cell__role">{role}</div>
      <div className="ds-stack-cell__usage">{usage}</div>
    </div>
  );
}
