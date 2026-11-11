import React from 'react';
import { describirVersion } from './version.mjs';

// Franja superior que dice qué versión de la app está abierta. En producción
// es discreta; en cualquier otro entorno es naranja para que no se confunda
// con la app publicada.
export default function EtiquetaVersion() {
  const { texto, esProduccion } = describirVersion({
    entorno: process.env.REACT_APP_VERCEL_ENV,
    commit: process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA,
  });

  return (
    <div
      data-testid="etiqueta-version"
      style={{
        padding: '4px 12px',
        fontFamily: 'Arial',
        fontSize: '12px',
        textAlign: 'center',
        backgroundColor: esProduccion ? '#f1f1f1' : '#b45309',
        color: esProduccion ? '#555' : '#fff',
        fontWeight: esProduccion ? 'normal' : 'bold',
      }}
    >
      {esProduccion ? texto : texto + ' — no es la app publicada'}
    </div>
  );
}
