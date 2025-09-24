import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import './styles.css';
import { useAuth } from '@/store/useAuth';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}

const container = document.getElementById('root')!;
const root = createRoot(container);
// Try to hydrate auth session (no-op if supabase disabled)
useAuth.getState().refreshSession().catch(()=>{});
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
