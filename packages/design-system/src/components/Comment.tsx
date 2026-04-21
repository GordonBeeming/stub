import type { ReactNode } from 'react';
import { cx } from './cx.js';

export interface CommentProps {
  children: ReactNode;
  // Opt-out of the `// ` prefix when the caller wants to include their own.
  bare?: boolean;
  className?: string;
}

export function Comment({ children, bare = false, className }: CommentProps) {
  return (
    <span className={cx('ds-comment', className)}>
      {bare ? null : '// '}
      {children}
    </span>
  );
}
