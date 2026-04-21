import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface FlowStepsProps {
  children: ReactNode;
  className?: string;
}

export function FlowSteps({ children, className }: FlowStepsProps) {
  return <div className={cx('ds-flow', className)}>{children}</div>;
}
