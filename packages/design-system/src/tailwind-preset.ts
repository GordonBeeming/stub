// Tailwind preset exposing DESIGN.md tokens as utilities. Optional — consumers
// bring their own Tailwind install. `Config['theme']` isn't imported directly so
// we don't force a peer dep on `tailwindcss`; the shape is kept loose on purpose.

type TailwindPreset = {
  darkMode: 'class' | 'media' | ['class', string];
  theme: {
    extend: Record<string, unknown>;
  };
  plugins: unknown[];
};

const gridPlugin = ({
  addUtilities,
}: {
  addUtilities: (utilities: Record<string, Record<string, string>>) => void;
}): void => {
  addUtilities({
    '.bg-grid': {
      'background-image': [
        'radial-gradient(circle at 15% 20%, rgba(70, 203, 255, 0.04), transparent 40%)',
        'radial-gradient(circle at 85% 80%, rgba(255, 204, 102, 0.03), transparent 40%)',
        'linear-gradient(var(--line-soft) 1px, transparent 1px)',
        'linear-gradient(90deg, var(--line-soft) 1px, transparent 1px)',
      ].join(', '),
      'background-size': 'auto, auto, 48px 48px, 48px 48px',
      'background-position': '0 0, 0 0, -1px -1px, -1px -1px',
    },
  });
};

export const preset: TailwindPreset = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-2': 'var(--bg-2)',
        'bg-3': 'var(--bg-3)',
        line: 'var(--line)',
        'line-soft': 'var(--line-soft)',
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        primary: 'var(--primary)',
        'primary-dim': 'var(--primary-dim)',
        accent: 'var(--accent)',
        danger: 'var(--danger)',
        success: 'var(--success)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      maxWidth: {
        wrap: 'var(--wrap-max)',
      },
    },
  },
  plugins: [gridPlugin],
};

export default preset;
