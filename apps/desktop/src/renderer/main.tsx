import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/host-grotesk/500.css';
import '@reforma-digital/design/desktop.css';
import './app.css';
import { App } from './app';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
