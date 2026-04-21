import type { ReactNode } from 'react';
import { cx } from './cx.js';

export type CLILineKind = 'comment' | 'cmd' | 'out';
export interface CLILine {
  kind: CLILineKind;
  text: string;
  // Optional arg-highlighting for `cmd` lines: string fragments rendered as .s
  highlights?: string[];
}

export interface CLIBlockProps {
  children?: ReactNode;
  lines?: CLILine[];
  className?: string;
}

// When `lines` is provided we render structured output. Otherwise the consumer
// passes raw children with `<span class="c|p|s|d">` for fine-grained control.
export function CLIBlock({ children, lines, className }: CLIBlockProps) {
  if (lines && lines.length > 0) {
    return (
      <pre className={cx('ds-cli', className)}>
        {lines.map((line, i) => (
          <CLILineRow key={i} line={line} />
        ))}
      </pre>
    );
  }
  return <pre className={cx('ds-cli', className)}>{children}</pre>;
}

function CLILineRow({ line }: { line: CLILine }) {
  if (line.kind === 'comment') {
    return (
      <>
        <span className="c">{line.text}</span>
        {'\n'}
      </>
    );
  }
  if (line.kind === 'out') {
    return (
      <>
        <span className="p">&gt;</span> <span className="s">{line.text}</span>
        {'\n'}
      </>
    );
  }
  // cmd
  if (!line.highlights || line.highlights.length === 0) {
    return (
      <>
        <span className="p">$</span> <span className="d">{line.text}</span>
        {'\n'}
      </>
    );
  }
  // Split the text around the highlight fragments, preserving order.
  const parts: Array<{ text: string; highlight: boolean }> = [{ text: line.text, highlight: false }];
  for (const h of line.highlights) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (!part || part.highlight) continue;
      const idx = part.text.indexOf(h);
      if (idx === -1) continue;
      const before = part.text.slice(0, idx);
      const after = part.text.slice(idx + h.length);
      const replacement: Array<{ text: string; highlight: boolean }> = [];
      if (before) replacement.push({ text: before, highlight: false });
      replacement.push({ text: h, highlight: true });
      if (after) replacement.push({ text: after, highlight: false });
      parts.splice(i, 1, ...replacement);
    }
  }
  return (
    <>
      <span className="p">$</span>{' '}
      {parts.map((p, i) =>
        p.highlight ? (
          <span key={i} className="s">
            {p.text}
          </span>
        ) : (
          <span key={i} className="d">
            {p.text}
          </span>
        ),
      )}
      {'\n'}
    </>
  );
}
