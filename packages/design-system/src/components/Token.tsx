import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface TokenProps {
  children: ReactNode;
  // `bare` drops the subtle background — for use inside mono prose where the
  // pill framing would be visual noise (e.g. inside a tagline).
  bare?: boolean;
  className?: string;
}

export function Token({ children, bare = false, className }: TokenProps) {
  return (
    <code className={cx('ds-token', bare && 'ds-token--bare', className)}>{children}</code>
  );
}
