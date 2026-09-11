import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/global.css';
import { sync } from './sync/engine';
import { createClaudeBackend, hasClaudeRuntime } from './sync/claudeBackend';

// Cloud backup: only when a host provides a document store (claude.ai artifact viewer).
void (async () => {
  const runtime = hasClaudeRuntime();
  const backend = runtime ? await createClaudeBackend() : null;
  await sync.start(backend, runtime ? 'claude.ai did not grant the storage capability to this view' : 'not running inside the claude.ai app');
})();

// The single-file build (Artifact / file hosting) has no service worker to register.
if (!import.meta.env.VITE_SINGLE_FILE) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
