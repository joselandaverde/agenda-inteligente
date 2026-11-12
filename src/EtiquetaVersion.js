import React from 'react';
import { describirVersion } from './version.mjs';
import { configuracion, esDemo } from './supabaseClient';

// Franja superior que dice qué versión de la app está abierta y sobre qué base
// de datos trabaja. En producción es discreta; en cualquier otro entorno es
// naranja para que no se confunda con la app publicada. Si el ambiente y la
// base no corresponden (por ejemplo, una vista previa sobre la base de
// producción), se pone roja.
export default function EtiquetaVersion() {
  const { texto, esProduccion, cruzada } = describirVersion({
    entorno: process.env.REACT_APP_VERCEL_ENV,
    commit: process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA,
    base: configuracion.base,
  });

  let fondo = '#b45309';
  let color = '#fff';
  let mensaje = texto + ' — no es la app publicada';
  if (cruzada) {
    fondo = '#b00020';
    mensaje = 'ATENCIÓN: el ambiente y la base de datos no corresponden — ' + texto;
  } else if (esProduccion) {
    fondo = '#f1f1f1';
    color = '#555';
    mensaje = texto;
  }
  if (esDemo) {
    fondo = '#5b3fb5';
    color = '#fff';
    mensaje = 'DEMOSTRACIÓN — datos inventados, nada se guarda — ' + texto;
  }

  return (
    <div
      data-testid="etiqueta-version"
      style={{
        padding: '4px 12px',
        fontFamily: 'Arial',
        fontSize: '12px',
        textAlign: 'center',
        backgroundColor: fondo,
        color,
        fontWeight: esProduccion && !cruzada ? 'normal' : 'bold',
      }}
    >
      {mensaje}
    </div>
  );
}
