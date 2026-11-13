import React, { useEffect, useState } from 'react';
import { leerActividad } from '../datos/auditoria.mjs';
import { describir, cuandoFue } from '../logica/auditoria.mjs';

// Registro de acciones delicadas (bloque 0-D): respaldos, restauraciones,
// borrados e interpretaciones con IA. Solo se consulta; no se puede cambiar.
// `senal` cambia cada vez que la app hace algo que pudo dejar un renglón.
export default function Actividad({ cliente, senal }) {
  const [renglones, setRenglones] = useState([]);
  const [estado, setEstado] = useState('cargando'); // cargando | listo | error

  useEffect(() => {
    let vigente = true;
    leerActividad(cliente).then(({ renglones: lista, error }) => {
      if (!vigente) return;
      setRenglones(lista);
      setEstado(error ? 'error' : 'listo');
    });
    return () => {
      vigente = false;
    };
  }, [cliente, senal]);

  return (
    <section className="ag-actividad" aria-label="Actividad">
      <h3>Actividad</h3>
      <p className="ag-respaldo-texto">Lo que quedó anotado de tus respaldos, restauraciones, borrados e interpretaciones con IA. No guarda el contenido de tus compromisos.</p>

      {estado === 'cargando' && <p className="ag-respaldo-texto">Cargando…</p>}
      {estado === 'error' && (
        <p className="ag-nota alerta" role="status">
          El registro de actividad no está disponible en este momento.
        </p>
      )}
      {estado === 'listo' && renglones.length === 0 && <p className="ag-respaldo-texto">Todavía no hay nada anotado.</p>}

      {renglones.length > 0 && (
        <ol className="ag-actividad-lista">
          {renglones.map((r) => {
            const d = describir(r);
            return (
              <li key={r.id} className={d.alerta ? 'alerta' : ''}>
                <span className="ag-actividad-cuando">{cuandoFue(r.created_at)}</span>
                <span className="ag-actividad-texto">
                  <strong>{d.titulo}</strong>
                  {d.detalle && <span>{d.detalle}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
