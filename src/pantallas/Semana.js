import React, { useState } from 'react';
import Icono from '../componentes/Icono';
import { Encabezado, Vacio } from '../componentes/Armazon';
import { AvisoRespaldo } from './Respaldo';
import { diaDe, fechaLarga, formatoDuracion, horaCorta, minutosDe, nivelImportancia, partesDia, repartir, resumen } from '../logica/agenda.mjs';
import { abiertosPorCategoria, filtrarPorCategoria, tonoDe } from '../logica/categorias.mjs';
import { columnasDesde, cuandoEs, mesDe, subtareasDeTarjeta, tareasAbiertas } from '../logica/semana.mjs';

const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// Un compromiso dentro de una columna: enseña su hora, sus primeras subtareas,
// su duración y su categoría. El título lo abre; el círculo lo marca.
// Fuera de la columna de un día (`conDia`), la tarjeta dice también su fecha.
function Tarjeta({ tarea, subtareas, categoria, indiceCategoria, hoyISO, conDia, alMarcar, alAbrir }) {
  const hecha = tarea.state === 'Hecho';
  const esTarea = tarea.type === 'Tarea';
  const importancia = tarea.priority || 'Media';
  const duracion = formatoDuracion(minutosDe(tarea, subtareas));
  const hora = tarea.date_promised ? horaCorta(tarea.date_promised) : '';
  const { visibles, resto } = subtareasDeTarjeta(esTarea ? subtareas : []);

  const cuando = conDia ? cuandoEs(tarea, hoyISO) : null;

  // Si la tarjeta ya dice su fecha y esa fecha es la límite, no se repite.
  let limite = '';
  if (esTarea && tarea.deadline && !(cuando && !tarea.date_promised)) {
    const p = partesDia(diaDe(tarea.deadline), hoyISO);
    limite = 'Límite: ' + (p.relativo || p.nombre + ' ' + p.numero);
  }

  return (
    <article className={'ag-tarjeta' + (hecha ? ' hecha' : '')}>
      {cuando ? <span className={'ag-tarjeta-cuando' + (cuando.vencida ? ' vencida' : '')}>{cuando.texto}</span> : hora && <span className="ag-hora">{hora}</span>}
      <button type="button" className="ag-tarjeta-titulo" onClick={alAbrir}>
        {tarea.title}
      </button>
      {tarea.type === 'Reunión' && tarea.location && <span className="ag-tarjeta-dato">{tarea.location}</span>}
      {visibles.map((s) => (
        <span key={s.id} className={'ag-tarjeta-sub' + (s.state === 'Hecho' ? ' hecha' : '')}>
          <i className={'ag-marca' + (s.state === 'Hecho' ? ' hecha' : '')}>{s.state === 'Hecho' && <Icono nombre="palomita" />}</i>
          {s.title}
        </span>
      ))}
      {resto > 0 && <span className="ag-tarjeta-dato">{resto} más</span>}
      {limite && <span className="ag-tarjeta-dato">{limite}</span>}
      <div className="ag-tarjeta-pie">
        {esTarea ? (
          <button
            type="button"
            className="ag-marca-boton"
            onClick={alMarcar}
            aria-pressed={hecha}
            aria-label={(hecha ? 'Reabrir: ' : 'Marcar como hecha: ') + tarea.title + '. Importancia ' + importancia.toLowerCase()}
            title={'Importancia ' + importancia.toLowerCase()}
          >
            <span className={'ag-marca p' + nivelImportancia(importancia) + (hecha ? ' hecha' : '')}>{hecha && <Icono nombre="palomita" />}</span>
          </button>
        ) : (
          <span className="ag-marca evento" title={tarea.type}>
            <Icono nombre={tarea.type === 'Reunión' ? 'personas' : 'campana'} />
          </span>
        )}
        {duracion && (
          <span className="ag-duracion" title="Duración estimada">
            {duracion}
          </span>
        )}
        {tarea.repetition && tarea.repetition !== 'Ninguna' && (
          <span className="ag-tarjeta-dato" title={'Se repite: ' + tarea.repetition}>
            <Icono nombre="repetir" />
          </span>
        )}
        {categoria && (
          <span className="ag-categoria">
            <i className={'ag-punto c' + tonoDe(indiceCategoria)} />
            {categoria.name}
          </span>
        )}
      </div>
    </article>
  );
}

// Calendario del mes: marca hoy, pone un punto en los días con algo y, al
// elegir un día, la semana por columnas empieza ahí.
function Calendario({ hoyISO, elegido, diasConAlgo, alElegir }) {
  const [a, m] = hoyISO.split('-').map(Number);
  const [visible, setVisible] = useState({ anio: a, mes: m - 1 });
  const mes = mesDe(visible.anio, visible.mes, hoyISO);

  return (
    <div className="ag-cal">
      <div className="ag-cal-mes">
        <button type="button" onClick={() => setVisible({ anio: mes.anio, mes: mes.mes - 1 })} aria-label="Mes anterior">
          ‹
        </button>
        <span>{mes.titulo}</span>
        <button type="button" onClick={() => setVisible({ anio: mes.anio, mes: mes.mes + 1 })} aria-label="Mes siguiente">
          ›
        </button>
      </div>
      <div className="ag-cal-dias">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((letra) => (
          <span key={letra} className="ag-cal-letra" aria-hidden="true">
            {letra}
          </span>
        ))}
        {mes.dias.map((d) => (
          <button
            key={d.iso}
            type="button"
            className={(d.delMes ? '' : 'fuera') + (d.esHoy ? ' hoy' : '') + (d.iso === elegido && !d.esHoy ? ' elegido' : '') + (diasConAlgo.has(d.iso) ? ' con-algo' : '')}
            onClick={() => alElegir(d.iso)}
            disabled={d.pasado}
            aria-label={fechaLarga(d.iso) + (d.esHoy ? ', hoy' : '') + (diasConAlgo.has(d.iso) ? ', con compromisos' : '')}
          >
            {d.numero}
          </button>
        ))}
      </div>
    </div>
  );
}

// Un renglón de la columna lateral: filtra por categoría o cambia de vista.
function ItemLateral({ texto, cantidad, activo, tono, alPulsar }) {
  return (
    <button type="button" className="ag-lateral-item" onClick={alPulsar} aria-current={activo ? 'true' : undefined}>
      {tono !== undefined && <i className={'ag-punto c' + tono} />}
      <span>{texto}</span>
      {cantidad > 0 && <em>{cantidad}</em>}
    </button>
  );
}

const TITULOS = { semana: 'Semana', tareas: 'Tareas', sinFecha: 'Sin fecha', hechos: 'Hechas', categorias: 'Categorías' };

// Vista de computadora: a la izquierda el mes y las categorías para filtrar;
// al centro, un día por columna. Todo sale de los mismos datos que el teléfono.
export default function Semana({ tareas, subtareasDe, categorias, hoyISO, cuenta, respaldo, administracion, alMarcar, alAbrir, alCapturar, alSalir }) {
  const [ver, setVer] = useState('semana');
  const [filtro, setFiltro] = useState('');
  const [inicio, setInicio] = useState(hoyISO);

  const conteo = abiertosPorCategoria(tareas);
  const filtroVigente = categorias.some((c) => c.id === filtro) ? filtro : '';
  const visibles = filtrarPorCategoria(tareas, filtroVigente);
  const reparto = repartir(visibles, hoyISO);
  const columnas = columnasDesde(visibles, hoyISO, inicio);
  const diasConAlgo = new Set(reparto.dias.filter((d) => d.tareas.some((t) => t.state !== 'Hecho')).map((d) => d.clave));
  const categoriaFiltro = categorias.find((c) => c.id === filtroVigente) || null;

  const pendientes = tareasAbiertas(visibles);
  // En las vistas que no van por día, cada tarjeta dice su fecha.
  const listas = { tareas: pendientes, sinFecha: reparto.sinFecha, hechos: reparto.hechos };
  const vacios = { tareas: 'No hay tareas abiertas', sinFecha: 'Nada sin fecha', hechos: 'Aún no hay compromisos hechos' };

  const tarjeta = (t) => (
    <Tarjeta
      key={t.id}
      conDia={ver === 'tareas' || ver === 'hechos'}
      tarea={t}
      subtareas={subtareasDe(t.id)}
      categoria={categorias.find((c) => c.id === t.project_id) || null}
      indiceCategoria={categorias.findIndex((c) => c.id === t.project_id)}
      hoyISO={hoyISO}
      alMarcar={() => alMarcar(t)}
      alAbrir={() => alAbrir(t)}
    />
  );

  let subtitulo = fechaLarga(hoyISO);
  if (ver === 'tareas') subtitulo = 'Todas las tareas abiertas, de la más importante a la menos';
  if (ver === 'sinFecha') subtitulo = 'Compromisos abiertos que aún no tienen día';
  if (ver === 'hechos') subtitulo = 'Lo que ya quedó concluido';
  if (ver === 'categorias') subtitulo = 'En orden de prioridad';
  if (categoriaFiltro && ver !== 'categorias') subtitulo += ' · solo ' + categoriaFiltro.name;

  return (
    <div className="ag-pc">
      <aside className="ag-lateral">
        <div className="ag-lateral-marca">Agenda</div>
        <Calendario
          hoyISO={hoyISO}
          elegido={inicio}
          diasConAlgo={diasConAlgo}
          alElegir={(iso) => {
            setInicio(iso);
            setVer('semana');
          }}
        />

        <div className="ag-lateral-etq">Categorías</div>
        <ItemLateral texto="Todas" cantidad={conteo.total} activo={!filtroVigente} alPulsar={() => setFiltro('')} />
        {categorias.map((c, i) => (
          <ItemLateral key={c.id} texto={c.name} cantidad={conteo.porId[c.id] || 0} activo={filtroVigente === c.id} tono={tonoDe(i)} alPulsar={() => setFiltro(c.id)} />
        ))}

        <div className="ag-lateral-etq">Ver</div>
        <ItemLateral texto="Semana" activo={ver === 'semana'} alPulsar={() => setVer('semana')} />
        <ItemLateral texto="Tareas" cantidad={pendientes.length} activo={ver === 'tareas'} alPulsar={() => setVer('tareas')} />
        <ItemLateral texto="Sin fecha" cantidad={reparto.sinFecha.length} activo={ver === 'sinFecha'} alPulsar={() => setVer('sinFecha')} />
        <ItemLateral texto="Hechas" activo={ver === 'hechos'} alPulsar={() => setVer('hechos')} />
        <ItemLateral texto="Administrar categorías" activo={ver === 'categorias'} alPulsar={() => setVer('categorias')} />

        <div className="ag-lateral-pie">
          <span>{cuenta}</span>
          <button type="button" className="ag-enlace" onClick={alSalir}>
            Salir
          </button>
        </div>
      </aside>

      <main className="ag-pc-centro">
        <div className="ag-pc-cab">
          <Encabezado titulo={TITULOS[ver]} subtitulo={subtitulo} />
          {ver === 'semana' && inicio !== hoyISO && (
            <button type="button" className="ag-boton-secundario" onClick={() => setInicio(hoyISO)}>
              Volver a hoy
            </button>
          )}
          {ver !== 'categorias' && (
            <button type="button" className="ag-boton" onClick={() => alCapturar(null)}>
              <Icono nombre="microfono" />
              Nuevo compromiso
            </button>
          )}
        </div>

        {respaldo.mostrar && ver !== 'categorias' && <AvisoRespaldo ultimo={respaldo.ultimo} alIr={() => setVer('categorias')} alPosponer={respaldo.alPosponer} />}

        {ver === 'semana' && (
          <div className="ag-columnas">
            {columnas.map((col) => {
              const r = resumen(col.tareas, subtareasDe);
              const pendiente = formatoDuracion(resumen(col.tareas.filter((t) => t.state !== 'Hecho'), subtareasDe).totalMin);
              const p = col.tipo === 'dia' ? partesDia(col.clave, hoyISO) : null;
              return (
                <section key={col.clave} className={'ag-columna' + (col.tipo === 'vencidos' ? ' alerta' : '')} aria-label={p ? fechaLarga(col.clave) : 'Vencidos'}>
                  <h2 className="ag-columna-enc">
                    <b>{p ? mayuscula(p.nombre) : 'Vencidos'}</b>
                    <span>{p ? p.numero + ' de ' + p.mes + (p.relativo ? ' · ' + p.relativo : '') : 'Su día ya pasó'}</span>
                  </h2>
                  <div className="ag-avance" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.porcentaje} aria-label="Avance del día">
                    <span style={{ width: r.porcentaje + '%' }} />
                  </div>
                  {col.tipo === 'dia' && (
                    <button type="button" className="ag-columna-agregar" onClick={() => alCapturar(col.clave)} aria-label={'Nuevo compromiso para el ' + fechaLarga(col.clave)}>
                      <span>
                        <Icono nombre="microfono" />
                        Dicta o escribe
                      </span>
                      {pendiente && <span className="ag-duracion">{pendiente}</span>}
                    </button>
                  )}
                  {col.tareas.map(tarjeta)}
                </section>
              );
            })}
          </div>
        )}

        {listas[ver] && (
          <>
            {listas[ver].length === 0 && <Vacio titulo={vacios[ver]} pista={categoriaFiltro ? 'En la categoría ' + categoriaFiltro.name + '.' : ''} />}
            <div className="ag-mosaico">{listas[ver].map(tarjeta)}</div>
          </>
        )}

        {ver === 'categorias' && <div className="ag-pc-administracion">{administracion}</div>}
      </main>
    </div>
  );
}
