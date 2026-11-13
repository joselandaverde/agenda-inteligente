import React from 'react';
import Icono from './Icono';
import { diaDe, formatoDuracion, horaCorta, minutosDe, nivelImportancia, partesDia, textoDeDelegada } from '../logica/agenda.mjs';
import { LEYENDA_INCOMPLETA, estaDelegada, estaIncompleta } from '../logica/seguimiento.mjs';

// Un compromiso en la lista. Las tareas llevan un círculo que las marca como
// hechas y cuyo color indica la importancia; reuniones y recordatorios llevan
// su ícono. Tocar el texto abre el compromiso. Si trae `paso` (bloque 3-A2), el
// renglón es esa subtarea de la tarea: el círculo la marca a ella (`alMarcarPaso`)
// y el texto abre la tarea.
export default function Renglon({ tarea, subtareas, categoria, indiceCategoria, abierta, hoyISO, alMarcar, alAbrir, paso, alMarcarPaso }) {
  const hecha = tarea.state === 'Hecho';
  const esTarea = tarea.type === 'Tarea';
  const subs = subtareas || [];
  const duracion = formatoDuracion(paso ? paso.time_estimated : minutosDe(tarea, subs));
  const hora = tarea.date_promised ? horaCorta(tarea.date_promised) : '';
  const importancia = tarea.priority || 'Media';
  const incompleta = estaIncompleta(tarea, subs.length);
  const titulo = paso ? paso.title : tarea.title;
  const marcar = paso ? alMarcarPaso : alMarcar;

  const datos = [];
  if (paso) datos.push('De: ' + tarea.title);
  if (estaDelegada(tarea)) datos.push(textoDeDelegada(tarea, hoyISO));
  if (tarea.type === 'Reunión' && tarea.location) datos.push(tarea.location);
  if (esTarea && subs.length > 0) {
    datos.push(subs.filter((s) => s.state === 'Hecho').length + ' de ' + subs.length + ' subtareas');
  }
  if (esTarea && tarea.deadline) {
    const dia = diaDe(tarea.deadline);
    if (dia) {
      const p = partesDia(dia, hoyISO);
      datos.push('Límite: ' + (p.relativo || p.nombre + ' ' + p.numero));
    }
  }

  return (
    <div className={'ag-renglon' + (hecha ? ' hecha' : '')}>
      {esTarea ? (
        <button
          type="button"
          className="ag-marca-boton"
          onClick={marcar}
          aria-pressed={hecha}
          aria-label={(hecha ? 'Reabrir: ' : 'Marcar como hecha: ') + titulo + '. Importancia ' + importancia.toLowerCase()}
          title={'Importancia ' + importancia.toLowerCase()}
        >
          <span className={'ag-marca p' + nivelImportancia(importancia) + (hecha ? ' hecha' : '')}>
            {hecha && <Icono nombre="palomita" />}
          </span>
        </button>
      ) : (
        <span className="ag-marca evento" title={tarea.type}>
          <Icono nombre={tarea.type === 'Reunión' ? 'personas' : 'campana'} />
        </span>
      )}

      <button type="button" className="ag-cuerpo" onClick={alAbrir} aria-expanded={abierta}>
        <span className="ag-titulo">{titulo}</span>
        <span className="ag-detalle">
          {hora && <span className="ag-hora">{hora}</span>}
          {datos.map((d) => (
            <span key={d}>{d}</span>
          ))}
          {tarea.repetition && tarea.repetition !== 'Ninguna' && (
            <>
              <Icono nombre="repetir" />
              <span>{tarea.repetition}</span>
            </>
          )}
          {categoria && (
            <span className="ag-categoria">
              <i className={'ag-punto c' + (((indiceCategoria % 6) + 6) % 6)} />
              {categoria.name}
              {tarea.grupo ? ' · ' + tarea.grupo : ''}
            </span>
          )}
          {!categoria && tarea.grupo && <span className="ag-categoria">{tarea.grupo}</span>}
          {incompleta && <span className="ag-incompleta">{LEYENDA_INCOMPLETA}</span>}
        </span>
      </button>

      {duracion && (
        <span className="ag-duracion" title="Duración estimada">
          {duracion}
        </span>
      )}
    </div>
  );
}
