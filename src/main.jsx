import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './hooks/useAuth.jsx';
import { TicketsProvider } from './hooks/useTickets.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TicketsProvider>
          <App />
        </TicketsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register the service worker (production builds only, best-effort —
// it fails silently inside sandboxed iframes, which is fine).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration skipped:', err?.message);
    });
  });
}
