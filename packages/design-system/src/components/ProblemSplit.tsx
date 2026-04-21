import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface ProblemSide {
  label: ReactNode;
  children: ReactNode;
}

export interface ProblemSplitProps {
  vs: ProblemSide;
  us: ProblemSide;
  className?: string;
}

export function ProblemSplit({ vs, us, className }: ProblemSplitProps) {
  return (
    <div className={cx('ds-problem', className)}>
      <div className="ds-problem__side">
        <div className="ds-problem__label ds-problem__label--vs">{vs.label}</div>
        <p className="ds-problem__body">{vs.children}</p>
      </div>
      <div className="ds-problem__side">
        <div className="ds-problem__label ds-problem__label--us">{us.label}</div>
        <p className="ds-problem__body">{us.children}</p>
      </div>
    </div>
  );
}
