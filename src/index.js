import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './estilo/variables.css';
import './estilo/app.css';
import App from './App';
import ConfiguracionFaltante from './ConfiguracionFaltante';
import EtiquetaVersion from './EtiquetaVersion';
import { configuracion, esDemo } from './supabaseClient';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// Sin configuración válida no se monta la app: no hay cliente de base de datos.
// La única excepción es el modo de demostración, que no usa ninguna base.
root.render(
  <StrictMode>
    <EtiquetaVersion />
    {configuracion.ok || esDemo ? <App /> : <ConfiguracionFaltante problemas={configuracion.problemas} />}
  </StrictMode>
);
