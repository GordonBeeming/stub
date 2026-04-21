import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface FlowStepProps {
  idx: ReactNode;
  title: ReactNode;
  desc: ReactNode;
  className?: string;
}

export function FlowStep({ idx, title, desc, className }: FlowStepProps) {
  return (
    <div className={cx('ds-flow-step', className)}>
      <span className="ds-flow-step__idx">{idx}</span>
      <div className="ds-flow-step__title">{title}</div>
      <div className="ds-flow-step__desc">{desc}</div>
    </div>
  );
}
