import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface FooterProps {
  left: ReactNode;
  right: ReactNode;
  className?: string;
}

export function Footer({ left, right, className }: FooterProps) {
  return (
    <footer className={cx('ds-footer', className)}>
      <div>{left}</div>
      <div>{right}</div>
    </footer>
  );
}
