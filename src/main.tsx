// src/main.tsx
// Purpose: React entry point
// Owned by: this file
// Used by: index.html
//
// v0.12.0 Checkpoint J — Modal System Replacement.
// <ModalProvider> wraps <App /> so both the normal app and the
// recovery-mode early-return branch in App.tsx can use useModal().

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ModalProvider } from './components/Modal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalProvider>
      <App />
    </ModalProvider>
  </StrictMode>
);
