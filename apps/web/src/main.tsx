import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './styles/globals.css';
import { App } from './app/app';
import { AppProviders } from './app/providers';
import { registerServiceWorker } from './lib/pwa/register-service-worker';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);

// Offline shell. Only in a production build, so the dev server keeps hot reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void registerServiceWorker(navigator.serviceWorker, window.isSecureContext);
}
