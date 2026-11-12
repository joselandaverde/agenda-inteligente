import React from 'react';

// Íconos dibujados con trazo, sin librerías. Decorativos: el texto que los
// acompaña dice lo mismo, así que se ocultan a los lectores de pantalla.
const TRAZOS = {
  personas: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6M18 14.5c1.8.7 3 2.2 3 4.5" />
    </>
  ),
  campana: (
    <>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  palomita: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  microfono: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  hoy: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  semana: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M8 14h2M12 14h2M16 14h.5M8 17h2M12 17h2" />
    </>
  ),
  etiqueta: (
    <>
      <path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8z" />
      <circle cx="8.5" cy="8.5" r="1.2" />
    </>
  ),
  repetir: (
    <>
      <path d="M5 11a7 7 0 0 1 12-4l2 2M19 13a7 7 0 0 1-12 4l-2-2" />
      <path d="M19 5v4h-4M5 19v-4h4" />
    </>
  ),
};

export default function Icono({ nombre }) {
  return (
    <svg className="ag-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRAZOS[nombre] || null}
    </svg>
  );
}
