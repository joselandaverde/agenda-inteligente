import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Icono from '../componentes/Icono';
import { Hoja } from '../componentes/Armazon';
import {
  actualizarCompromiso, borrarCompromiso, alternarHecho, agregarSubtareas, alternarSubtarea, borrarSubtarea, intercambiarSubtareas,
} from '../datos/compromisos';
import { diaDe, fechaLarga, formatoDuracion, horaCorta, minutosDe, nivelImportancia, partesDia } from '../logica/agenda.mjs';
import { IMPORTANCIAS, HORAS, MINUTOS, lineasDe } from '../logica/compromiso.mjs';
import { edicionDe, armarActualizacion, minutosValidos, vecinaDe, DELEGABLES, admitePrioridad, edicionPrioridad, cambiosPrioridad, datosDePrioridad } from '../logica/detalle.mjs';
import { anotarAccion } from '../datos/anotarAccion';
import { ACCIONES } from '../logica/auditoria.mjs';

function Opcion({ icono, etiqueta, children }) {
  return (
    <div className="ag-opcion">
      <Icono nombre={icono} />
      <span className="ag-opcion-etq">{etiqueta}</span>
      <span className="ag-opcion-valor">{children}</span>
    </div>
  );
}

// Pantalla de un compromiso: se ve completo, se editan sus datos y, si es una
// tarea, se marcan, agregan, ordenan y borran sus subtareas.
export default function Detalle({ tarea, subtareas, categorias, hoyISO, alCerrar, alCambiar, alAvisar }) {
  const [e, setE] = useState(() => edicionDe(tarea));
  // Prioridad (bloque 1-A): solo en tareas y solo si la base ya trae esas columnas.
  const conPrioridad = tarea.type === 'Tarea' && admitePrioridad(tarea);
  const [pr, setPr] = useState(() => edicionPrioridad(tarea));
  const prioridad = conPrioridad ? datosDePrioridad(tarea) : [];
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [nuevaSubtarea, setNuevaSubtarea] = useState('');
  const [nuevaSubtareaTiempo, setNuevaSubtareaTiempo] = useState('30');
  const [pegarLista, setPegarLista] = useState(false);
  const [textoLista, setTextoLista] = useState('');
  const [tiempoLista, setTiempoLista] = useState('30');

  const poner = (cambios) => setE((previo) => ({ ...previo, ...cambios }));
  const esTarea = tarea.type === 'Tarea';
  const hecha = tarea.state === 'Hecho';
  const subs = subtareas || [];
  const hechas = subs.filter((s) => s.state === 'Hecho');
  const minutosHechos = hechas.reduce((s, x) => s + (Number(x.time_estimated) || 0), 0);
  const minutosTotales = minutosDe(tarea, subs);
  const avance = subs.length > 0 ? Math.round((hechas.length / subs.length) * 100) : 0;
  const categoria = categorias.find((c) => c.id === tarea.project_id) || null;

  // Línea de cuándo: fecha y hora, y para las tareas su fecha límite.
  const cuando = [];
  if (tarea.date_promised) cuando.push(fechaLarga(diaDe(tarea.date_promised)) + ', ' + horaCorta(tarea.date_promised));
  if (esTarea && tarea.deadline) {
    const p = partesDia(diaDe(tarea.deadline), hoyISO);
    cuando.push('Límite: ' + (p.relativo || p.nombre + ' ' + p.numero + ' de ' + p.mes));
  }
  if (cuando.length === 0) cuando.push('Sin fecha');

  // Datos que hoy solo se consultan aquí.
  const datos = [];
  if (tarea.repetition && tarea.repetition !== 'Ninguna') datos.push({ icono: 'repetir', texto: 'Se repite: ' + tarea.repetition + (tarea.repetition_end ? ' hasta ' + fechaLarga(diaDe(tarea.repetition_end)) : '') });
  if (tarea.type === 'Reunión' && tarea.location) datos.push({ icono: 'hoy', texto: tarea.location });
  if (tarea.type === 'Reunión' && Array.isArray(tarea.participantes) && tarea.participantes.length > 0) datos.push({ icono: 'personas', texto: tarea.participantes.join(', ') });
  if (tarea.type === 'Reunión' && tarea.time_estimated) datos.push({ icono: 'cronometro', texto: 'Dura ' + formatoDuracion(tarea.time_estimated) });
  if (Array.isArray(tarea.notification_channels) && tarea.notification_channels.length > 0) datos.push({ icono: 'campana', texto: 'Aviso por ' + tarea.notification_channels[0] + ', ' + (tarea.reminder_minutes_before || 15) + ' min antes' });

  async function ejecutar(accion, alTerminar) {
    setOcupado(true);
    setMensaje('');
    const resultado = await accion();
    setOcupado(false);
    if (resultado.error) {
      setMensaje('No se pudo guardar: ' + resultado.error.message);
      return;
    }
    alCambiar();
    if (alTerminar) alTerminar(resultado);
  }

  const guardar = () =>
    ejecutar(
      () => actualizarCompromiso(supabase, tarea.id, conPrioridad ? { ...armarActualizacion(tarea, e), ...cambiosPrioridad(pr) } : armarActualizacion(tarea, e)),
      () => {
        alAvisar('Cambios guardados');
        alCerrar();
      }
    );

  const marcar = () => ejecutar(() => alternarHecho(supabase, tarea));

  function borrar() {
    const ok = window.confirm('¿Borrar "' + tarea.title + '"? Esta acción no se puede deshacer.');
    if (!ok) return;
    ejecutar(
      async () => {
        const r = await borrarCompromiso(supabase, tarea.id);
        if (r.error) return r;
        // El borrado queda en el registro; si no se pudo anotar, se avisa.
        const nota = await anotarAccion(supabase, { accion: ACCIONES.COMPROMISO_BORRAR, recurso: 'tasks:' + tarea.id, detalle: { tipo: tarea.type } });
        return { error: null, sinAnotar: Boolean(nota.error) };
      },
      (r) => {
        alAvisar(r && r.sinAnotar ? 'Compromiso borrado; no se pudo anotar en Actividad' : 'Compromiso borrado');
        alCerrar();
      }
    );
  }

  function agregar() {
    if (!nuevaSubtarea.trim()) return;
    const minutos = minutosValidos(nuevaSubtareaTiempo);
    if (!minutos) {
      setMensaje('El tiempo estimado de la subtarea es obligatorio.');
      return;
    }
    ejecutar(
      () => agregarSubtareas(supabase, tarea.id, [nuevaSubtarea.trim()], minutos, subs.length),
      () => {
        setNuevaSubtarea('');
        setNuevaSubtareaTiempo('30');
      }
    );
  }

  function agregarLista() {
    const lineas = lineasDe(textoLista);
    if (lineas.length === 0) {
      setMensaje('Pega al menos una línea de texto.');
      return;
    }
    const minutos = minutosValidos(tiempoLista);
    if (!minutos) {
      setMensaje('El tiempo por subtarea es obligatorio.');
      return;
    }
    ejecutar(
      () => agregarSubtareas(supabase, tarea.id, lineas, minutos, subs.length),
      () => {
        setTextoLista('');
        setTiempoLista('30');
        setPegarLista(false);
      }
    );
  }

  function mover(sub, direccion) {
    const vecina = vecinaDe(subs, sub, direccion);
    if (vecina) ejecutar(() => intercambiarSubtareas(supabase, sub, vecina));
  }

  return (
    <Hoja titulo={tarea.type} alCerrar={alCerrar} textoCerrar="Volver">
      <div className="ag-detalle-cuando">
        {esTarea ? (
          <button type="button" className="ag-marca-boton" onClick={marcar} disabled={ocupado} aria-pressed={hecha} aria-label={hecha ? 'Reabrir' : 'Marcar como hecha'}>
            <span className={'ag-marca p' + nivelImportancia(tarea.priority) + (hecha ? ' hecha' : '')}>{hecha && <Icono nombre="palomita" />}</span>
          </button>
        ) : (
          <span className="ag-marca evento">
            <Icono nombre={tarea.type === 'Reunión' ? 'personas' : 'campana'} />
          </span>
        )}
        <span className="ag-detalle-fecha">{cuando.join(' · ')}</span>
        <span className={'ag-chip p' + nivelImportancia(tarea.priority)}>{tarea.priority || 'Media'}</span>
      </div>

      <label className="ag-etq" htmlFor="detalle-titulo">
        Título
      </label>
      <input id="detalle-titulo" className="ag-campo ag-campo-titulo" type="text" value={e.titulo} onChange={(ev) => poner({ titulo: ev.target.value })} />

      {(categoria || datos.length > 0 || hecha) && (
        <ul className="ag-datos">
          {hecha && (
            <li>
              <Icono nombre="palomita" />
              Hecha
            </li>
          )}
          {categoria && (
            <li>
              <Icono nombre="etiqueta" />
              {categoria.name}
            </li>
          )}
          {datos.map((d) => (
            <li key={d.texto}>
              <Icono nombre={d.icono} />
              {d.texto}
            </li>
          ))}
        </ul>
      )}

      {esTarea && (
        <section className="ag-detalle-subtareas" aria-label="Subtareas">
          <div className="ag-detalle-avance">
            <span>
              <strong>
                {hechas.length} de {subs.length}
              </strong>{' '}
              {subs.length === 1 ? 'subtarea' : 'subtareas'}
            </span>
            {subs.length > 0 && (
              <span>
                {formatoDuracion(minutosHechos) || '0:00'} de {formatoDuracion(minutosTotales) || '0:00'}
              </span>
            )}
          </div>
          {subs.length > 0 && (
            <div className="ag-avance" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance} aria-label="Avance de las subtareas">
              <span style={{ width: avance + '%' }} />
            </div>
          )}

          {subs.map((s, i) => (
            <div key={s.id} className={'ag-subfila' + (s.state === 'Hecho' ? ' hecha' : '')}>
              <button type="button" className="ag-marca-boton" onClick={() => ejecutar(() => alternarSubtarea(supabase, s))} disabled={ocupado} aria-pressed={s.state === 'Hecho'} aria-label={(s.state === 'Hecho' ? 'Reabrir: ' : 'Marcar como hecha: ') + s.title}>
                <span className={'ag-marca' + (s.state === 'Hecho' ? ' hecha' : '')}>{s.state === 'Hecho' && <Icono nombre="palomita" />}</span>
              </button>
              <span className="ag-subfila-texto">{s.title}</span>
              {s.time_estimated ? <span className="ag-duracion">{formatoDuracion(s.time_estimated)}</span> : null}
              <button type="button" className="ag-mini" onClick={() => mover(s, 'subir')} disabled={ocupado || i === 0} aria-label={'Subir: ' + s.title}>
                ▲
              </button>
              <button type="button" className="ag-mini" onClick={() => mover(s, 'bajar')} disabled={ocupado || i === subs.length - 1} aria-label={'Bajar: ' + s.title}>
                ▼
              </button>
              <button type="button" className="ag-mini peligro" onClick={() => ejecutar(() => borrarSubtarea(supabase, s, subs.filter((x) => x.id !== s.id)))} disabled={ocupado} aria-label={'Borrar subtarea: ' + s.title}>
                ✕
              </button>
            </div>
          ))}

          <div className="ag-subtarea-nueva">
            <input className="ag-campo" type="text" aria-label="Nueva subtarea" value={nuevaSubtarea} onChange={(ev) => setNuevaSubtarea(ev.target.value)} placeholder="Nueva subtarea..." />
            <input className="ag-campo corto" type="number" inputMode="numeric" min="1" aria-label="Minutos de la subtarea" value={nuevaSubtareaTiempo} onChange={(ev) => setNuevaSubtareaTiempo(ev.target.value)} />
            <button type="button" className="ag-boton-secundario" onClick={agregar} disabled={ocupado}>
              Agregar
            </button>
          </div>
          <button type="button" className="ag-mas" aria-expanded={pegarLista} onClick={() => setPegarLista(!pegarLista)}>
            {pegarLista ? 'Cerrar la lista' : 'Pegar una lista de subtareas'}
          </button>
          {pegarLista && (
            <>
              <label className="ag-etq" htmlFor="detalle-lista">
                Una subtarea por renglón
              </label>
              <textarea id="detalle-lista" className="ag-campo ancho" rows={4} value={textoLista} onChange={(ev) => setTextoLista(ev.target.value)} placeholder={'Calentamiento\nRutina de fuerza\nEnfriamiento'} />
              <div className="ag-subtarea-nueva">
                <label className="ag-etq" htmlFor="detalle-lista-min">
                  Minutos para cada una
                </label>
                <input id="detalle-lista-min" className="ag-campo corto" type="number" inputMode="numeric" min="1" value={tiempoLista} onChange={(ev) => setTiempoLista(ev.target.value)} />
                <button type="button" className="ag-boton-secundario" onClick={agregarLista} disabled={ocupado}>
                  Agregar la lista
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <div className="ag-opciones">
        <Opcion icono="hoy" etiqueta="Fecha">
          <input className="ag-campo" type="date" aria-label="Fecha" value={e.fecha} onChange={(ev) => poner({ fecha: ev.target.value })} />
        </Opcion>
        {e.fecha && (
          <Opcion icono="reloj" etiqueta="Hora">
            <span className="ag-hora-campos">
              <select className="ag-campo" aria-label="Hora" value={e.hora12} onChange={(ev) => poner({ hora12: ev.target.value })}>
                {HORAS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              :
              <select className="ag-campo" aria-label="Minutos" value={e.minutos} onChange={(ev) => poner({ minutos: ev.target.value })}>
                {MINUTOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select className="ag-campo" aria-label="AM o PM" value={e.ampm} onChange={(ev) => poner({ ampm: ev.target.value })}>
                <option value="AM">a. m.</option>
                <option value="PM">p. m.</option>
              </select>
            </span>
          </Opcion>
        )}
        <Opcion icono="bandera" etiqueta="Importancia">
          <select className="ag-campo" aria-label="Importancia" value={e.importancia} onChange={(ev) => poner({ importancia: ev.target.value })}>
            {IMPORTANCIAS.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.texto}
              </option>
            ))}
          </select>
        </Opcion>
        <Opcion icono="etiqueta" etiqueta="Categoría">
          <select className="ag-campo" aria-label="Categoría" value={e.categoria} onChange={(ev) => poner({ categoria: ev.target.value })}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Opcion>
        {esTarea && subs.length === 0 && (
          <Opcion icono="cronometro" etiqueta="Tiempo estimado (minutos)">
            <input className="ag-campo corto" type="number" inputMode="numeric" min="1" aria-label="Tiempo estimado en minutos" value={e.tiempoEstimado} onChange={(ev) => poner({ tiempoEstimado: ev.target.value })} />
          </Opcion>
        )}
      </div>
      {esTarea && subs.length > 0 && <p className="ag-ayuda">El tiempo de la tarea es la suma de sus subtareas: {minutosTotales} min.</p>}

      {conPrioridad && (
        <section className="ag-prioridad" aria-label="Prioridad">
          <span className="ag-etq">Prioridad</span>
          {prioridad.length > 0 && (
            <dl className="ag-prioridad-datos">
              {prioridad.map((d) => (
                <div key={d.nombre}>
                  <dt>{d.nombre}</dt>
                  <dd>{d.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="ag-opciones">
            <Opcion icono="hoy" etiqueta="Retomar el">
              <input className="ag-campo" type="date" aria-label="Retomar el" value={pr.retomarEl} onChange={(ev) => setPr({ ...pr, retomarEl: ev.target.value })} />
            </Opcion>
            <Opcion icono="personas" etiqueta="Delegable">
              <select className="ag-campo" aria-label="Delegable" value={pr.delegable} onChange={(ev) => setPr({ ...pr, delegable: ev.target.value })}>
                <option value="">Sin definir</option>
                {DELEGABLES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Opcion>
          </div>
          <p className="ag-ayuda">Con una fecha en "Retomar el", la tarea no aparece entre las sugeridas hasta ese día, salvo que su fecha límite llegue antes.</p>
        </section>
      )}

      <label className="ag-etq" htmlFor="detalle-notas">
        {tarea.type === 'Reunión' ? 'Comentarios o lo que se trató' : 'Notas'}
      </label>
      <textarea
        id="detalle-notas"
        className="ag-campo ancho"
        rows={3}
        value={e.notas}
        onChange={(ev) => poner({ notas: ev.target.value })}
        placeholder={tarea.type === 'Reunión' ? 'Qué se acordó, pendientes, siguientes pasos...' : 'Opcional'}
      />

      {mensaje && (
        <p className="ag-nota alerta" role="alert">
          {mensaje}
        </p>
      )}
      <button type="button" className="ag-boton principal" onClick={guardar} disabled={ocupado}>
        Guardar cambios
      </button>
      {esTarea && (
        <button type="button" className="ag-boton-secundario ancho" onClick={marcar} disabled={ocupado}>
          {hecha ? 'Reabrir la tarea' : 'Marcar como hecha'}
        </button>
      )}
      <button type="button" className="ag-enlace peligro" onClick={borrar} disabled={ocupado}>
        Borrar este compromiso
      </button>
    </Hoja>
  );
}
