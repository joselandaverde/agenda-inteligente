import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import ConfiguracionFaltante from './ConfiguracionFaltante';
import EtiquetaVersion from './EtiquetaVersion';
import { configuracion } from './supabaseClient';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// Sin configuración válida no se monta la app: no hay cliente de base de datos.
root.render(
  <StrictMode>
    <EtiquetaVersion />
    {configuracion.ok ? <App /> : <ConfiguracionFaltante problemas={configuracion.problemas} />}
  </StrictMode>
);
