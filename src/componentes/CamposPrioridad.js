import React from 'react';
import Icono from './Icono';
import { IMPACTOS, CAMPOS_IMPACTO, URGENCIAS, ESFUERZOS, ME_ESPERAN } from '../logica/prioridad.mjs';

function Fila({ icono, etiqueta, ayuda, children }) {
  return (
    <div className="ag-opcion">
      <Icono nombre={icono} />
      <span className="ag-opcion-etq">
        {etiqueta}
        {ayuda && <small className="ag-opcion-ayuda">{ayuda}</small>}
      </span>
      <span className="ag-opcion-valor">{children}</span>
    </div>
  );
}

// Los datos de prioridad de una tarea (bloque 3-A), iguales en el detalle y en
// la captura: los cuatro impactos, la urgencia, el esfuerzo, si te esperan y el
// avance. `valores` es la forma de formulario (prioridad.mjs) y `alCambiar`
// recibe lo que cambió. La fecha límite se pide solo si `conFechaLimite`: la
// captura ya la tiene en su propio renglón.
export default function CamposPrioridad({ valores, alCambiar, conFechaLimite = false }) {
  return (
    <>
      <p className="ag-ayuda">¿Cuánto aporta esta tarea en cada área? Nulo es nada, moderado es algo y alto es mucho. Lo que dejes sin calificar cuenta como nulo.</p>
      <div className="ag-opciones">
        {CAMPOS_IMPACTO.map((c) => (
          <Fila key={c.clave} icono="lista" etiqueta={c.nombre} ayuda={c.ayuda}>
            <select className="ag-campo" aria-label={'Impacto: ' + c.nombre + '. ' + c.ayuda} title={c.ayuda} value={valores[c.clave]} onChange={(ev) => alCambiar({ [c.clave]: ev.target.value })}>
              {IMPACTOS.map((i) => (
                <option key={i.valor} value={i.valor}>
                  {i.texto}
                </option>
              ))}
            </select>
          </Fila>
        ))}
        <Fila icono="bandera" etiqueta="Urgencia" ayuda="Fecha dura: no se puede mover. Ventana: oportunidad con plazo. Sin fecha: sin presión">
          <select className="ag-campo" aria-label="Urgencia" value={valores.urgencia} onChange={(ev) => alCambiar({ urgencia: ev.target.value })}>
            <option value="">Sin definir</option>
            {URGENCIAS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Fila>
        {conFechaLimite && (
          <Fila icono="hoy" etiqueta="Fecha límite">
            <input className="ag-campo" type="date" aria-label="Fecha límite" value={valores.fechaLimite} onChange={(ev) => alCambiar({ fechaLimite: ev.target.value })} />
          </Fila>
        )}
        <Fila icono="cronometro" etiqueta="Esfuerzo" ayuda="Rápido: menos de 30 min. Medio: horas. Grande: semanas">
          <select className="ag-campo" aria-label="Esfuerzo" value={valores.esfuerzo} onChange={(ev) => alCambiar({ esfuerzo: ev.target.value })}>
            <option value="">Sin definir</option>
            {ESFUERZOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </Fila>
        <Fila icono="personas" etiqueta="¿Te esperan?" ayuda="Alguien depende de que lo hagas (solo desempata)">
          <select className="ag-campo" aria-label="¿Te esperan?" value={valores.meEsperan} onChange={(ev) => alCambiar({ meEsperan: ev.target.value })}>
            {ME_ESPERAN.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </Fila>
        <Fila icono="reloj" etiqueta="Avance (%)" ayuda="Qué parte ya está hecha">
          <input className="ag-campo corto" type="number" inputMode="numeric" min="0" max="100" aria-label="Avance en porcentaje" value={valores.avance} onChange={(ev) => alCambiar({ avance: ev.target.value })} placeholder="0" />
        </Fila>
      </div>
      <p className="ag-ayuda">Con fecha límite, la urgencia se calcula sola por los días que faltan y esa categoría ya no cuenta. Rápido, medio o grande y "¿te esperan?" solo sirven para desempatar.</p>
    </>
  );
}
