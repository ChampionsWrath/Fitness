import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/global.css';
import { sync } from './sync/engine';
import { supabaseConfigured } from './sync/supabaseBackend';

// Cloud backup: App.tsx starts the real backend once sign-in resolves. Set the
// honest "off" state immediately so the banner never sits blank while that loads.
if (!supabaseConfigured()) void sync.start(null, 'Cloud backup not set up yet (see README)');

// The single-file build (Artifact / file hosting) has no service worker to register.
if (!import.meta.env.VITE_SINGLE_FILE) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
