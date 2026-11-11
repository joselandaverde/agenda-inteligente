import React from 'react';

// Se muestra en lugar de la app cuando faltan las variables de configuración.
// La app no se conecta a ninguna base de datos en ese caso.
export default function ConfiguracionFaltante({ problemas }) {
  return (
    <div
      data-testid="configuracion-faltante"
      style={{ padding: '40px', maxWidth: '520px', margin: '0 auto', fontFamily: 'Arial' }}
    >
      <h1>Mi Agenda</h1>
      <p style={{ color: '#b00020', fontWeight: 'bold' }}>
        Falta la configuración de la base de datos.
      </p>
      <p style={{ color: '#444' }}>
        La app no se conectó a ninguna base. Revisa estas variables de entorno en
        Vercel para este ambiente y vuelve a desplegar:
      </p>
      <ul style={{ color: '#444' }}>
        {(problemas || []).map((p) => (
          <li key={p.variable}>
            <code>{p.variable}</code>: {p.motivo}
          </li>
        ))}
      </ul>
    </div>
  );
}
