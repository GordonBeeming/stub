import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface SectionHeaderProps {
  /** Zero-padded number ("01", "02"...) for the pitch-doc voice on in-app
   *  chrome. Marketing surfaces can omit it and the heading renders flush. */
  num?: string;
  children: ReactNode;
  className?: string;
}

export function SectionHeader({ num, children, className }: SectionHeaderProps) {
  return (
    <h2 className={cx('ds-section-header', className)}>
      {num ? <span className="ds-section-header__num">{num}</span> : null}
      <span>{children}</span>
    </h2>
  );
}
