import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    // ThemeToggle carries the `'use client'` directive and needs its own
    // bundle so Next.js can treat the whole module as a client boundary.
    // Barreling it through `index.ts` loses the directive at the consumer.
    'theme-toggle': 'src/components/ThemeToggle.tsx',
    fonts: 'src/fonts.ts',
    'tailwind-preset': 'src/tailwind-preset.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // CSS is shipped as source files via the package exports map — never bundled into JS.
  injectStyle: false,
  splitting: false,
  target: 'es2022',
});
