import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Design-system assets come in a fixed order: fonts register @font-face,
// tokens.css seeds the CSS custom properties every component reads, then
// the component-styles sheet layers on top. The app's globals.css adds
// the body reset and focus-visible treatment — last so it wins where it
// overlaps.
import '@gordonbeeming/design-system/fonts';
import '@gordonbeeming/design-system/tokens.css';
import '@gordonbeeming/design-system/styles.css';
import './globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  // Fail loudly in dev — a missing #root means index.html drifted from the
  // entry file. Silent failure would just render a blank page.
  throw new Error('stub: #root element missing from index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
