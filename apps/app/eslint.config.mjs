import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Next 16 deprecated `next lint`, so we run ESLint directly.
// eslint-config-next v16 ships flat-config arrays from both of these entry
// points — we spread them so the rules from core-web-vitals and the TS-aware
// preset both land on files under this app only.
const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.open-next/**',
      '.turbo/**',
      '.wrangler/**',
      'next-env.d.ts',
      // app/stub/** is a marketing surface owned by another agent; we lint
      // around it rather than through it.
      'app/stub/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
];

export default eslintConfig;
