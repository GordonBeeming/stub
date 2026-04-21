'use client';

import { useEffect, useState } from 'react';
import { cx } from './cx.js';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'stub-theme';
const OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'system' },
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' },
];

export interface ThemeToggleProps {
  className?: string;
}

// Reads localStorage for the persisted choice and reflects it onto <html>.
// The initial paint already had its data-theme set by the pre-hydration
// script in the app's root layout — this component keeps React state in
// sync with that and handles subsequent changes.
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    const stored = readStored();
    setMode(stored);
  }, []);

  const apply = (next: ThemeMode) => {
    setMode(next);
    if (typeof window === 'undefined') return;
    if (next === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
      delete document.documentElement.dataset.theme;
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.dataset.theme = next;
    }
  };

  return (
    <div role="radiogroup" aria-label="theme" className={cx('ds-theme-toggle', className)}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={mode === opt.value}
          onClick={() => apply(opt.value)}
          className={cx('ds-theme-toggle__opt', mode === opt.value && 'is-active')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function readStored(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark') return raw;
  return 'system';
}
