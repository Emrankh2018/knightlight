import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// A stale deploy can make a lazy chunk vanish; reload once to pick up the new build.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'kl-preload-reload';
  if (sessionStorage.getItem(key) === null) {
    sessionStorage.setItem(key, '1');
    event.preventDefault();
    window.location.reload();
  }
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
