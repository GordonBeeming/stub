import type { ReactNode, SVGAttributes } from 'react';
import { cx } from './cx.js';

export interface DiagramProps {
  children: ReactNode;
  caption?: ReactNode;
  title: string;
  desc?: string;
  viewBox?: string;
  svgProps?: Omit<SVGAttributes<SVGSVGElement>, 'viewBox' | 'className'>;
  className?: string;
}

export function Diagram({
  children,
  caption,
  title,
  desc,
  viewBox = '0 0 820 360',
  svgProps,
  className,
}: DiagramProps) {
  return (
    <>
      <div className={cx('ds-diagram', className)}>
        <svg
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          className="ds-diagram__svg"
          {...svgProps}
        >
          <title>{title}</title>
          {desc ? <desc>{desc}</desc> : null}
          {children}
        </svg>
      </div>
      {caption ? <p className="ds-diagram__caption">{caption}</p> : null}
    </>
  );
}
