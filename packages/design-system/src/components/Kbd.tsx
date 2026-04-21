import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface KbdProps {
  children: ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return <kbd className={cx('ds-kbd', className)}>{children}</kbd>;
}
