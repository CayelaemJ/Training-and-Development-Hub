import { createRoot } from 'react-dom/client';

import App from './App';
import { InstallApp, InstallAppProvider } from './components/install-app';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import { applyAppearance, cachedAppearance } from './lib/appearance';

// Apply the saved look before the first paint so the app does not flash.
applyAppearance(cachedAppearance());

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <InstallAppProvider>
      <App />
      <InstallApp />
    </InstallAppProvider>
  </ErrorBoundary>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error) => console.warn('CABO app worker not available', error));
  });
}
