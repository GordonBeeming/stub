import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface OSSCalloutProps {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

export function OSSCallout({ icon, title, children, className }: OSSCalloutProps) {
  return (
    <div className={cx('ds-oss', className)}>
      <div className="ds-oss__icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <h3 className="ds-oss__title">{title}</h3>
        <p className="ds-oss__body">{children}</p>
      </div>
    </div>
  );
}
