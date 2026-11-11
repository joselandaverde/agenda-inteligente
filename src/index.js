import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import EtiquetaVersion from './EtiquetaVersion';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <EtiquetaVersion />
    <App />
  </StrictMode>
);
