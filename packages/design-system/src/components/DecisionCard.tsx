import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface DecisionCardProps {
  label?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DecisionCard({
  label = 'VERDICT',
  title,
  children,
  className,
}: DecisionCardProps) {
  return (
    <div className={cx('ds-decision', className)}>
      <span className="ds-decision__label">{label}</span>
      <h3 className="ds-decision__title">{title}</h3>
      {children}
    </div>
  );
}
