import React, { useState } from 'react';
import { Vacio } from '../componentes/Armazon';
import { agregarCategoria, borrarCategoria, moverCategoria, guardarDescripcion } from '../datos/categorias.mjs';
import { abiertosPorCategoria, opcionesDePosicion, textoAbiertos, tonoDe } from '../logica/categorias.mjs';
import { anotarAccion } from '../datos/anotarAccion';
import { ACCIONES } from '../logica/auditoria.mjs';

// Categorías en orden de prioridad: agregar en la posición que se quiera,
// subir y bajar, editar la descripción y borrar.
export default function Categorias({ cliente, categorias, tareas, alCambiar, alAvisar }) {
  const [nombre, setNombre] = useState('');
  const [posicion, setPosicion] = useState('1');
  const [abiertaId, setAbiertaId] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const abiertos = abiertosPorCategoria(tareas);

  // Una operación a la vez: mientras escribe, los botones quedan inactivos.
  async function ejecutar(operacion, alTerminar) {
    setOcupado(true);
    setMensaje('');
    const resultado = await operacion();
    setOcupado(false);
    if (resultado.error) {
      setMensaje('No se pudo guardar: ' + resultado.error.message);
      return;
    }
    if (alTerminar) alTerminar(resultado);
    alCambiar();
  }

  function agregar() {
    if (!nombre.trim()) {
      setMensaje('Escribe el nombre de la categoría.');
      return;
    }
    const creada = nombre.trim();
    ejecutar(
      () => agregarCategoria(cliente, categorias, nombre, posicion),
      () => {
        setNombre('');
        setPosicion('1');
        alAvisar('Categoría "' + creada + '" agregada');
      }
    );
  }

  function abrir(cat) {
    if (abiertaId === cat.id) {
      setAbiertaId(null);
      return;
    }
    setAbiertaId(cat.id);
    setDescripcion(cat.context || '');
    setMensaje('');
  }

  function borrar(cat) {
    const cuantas = (tareas || []).filter((t) => t.project_id === cat.id).length;
    const pregunta =
      cuantas > 0
        ? 'La categoría "' + cat.name + '" tiene ' + cuantas + (cuantas === 1 ? ' compromiso' : ' compromisos') + '. Si la borras, quedarán sin categoría. ¿Confirmas?'
        : '¿Borrar la categoría "' + cat.name + '"?';
    if (!window.confirm(pregunta)) return;
    ejecutar(
      async () => {
        const r = await borrarCategoria(cliente, categorias, cat);
        if (r.error) return r;
        // El borrado queda en el registro; si no se pudo anotar, se avisa.
        const nota = await anotarAccion(cliente, { accion: ACCIONES.CATEGORIA_BORRAR, recurso: 'projects:' + cat.id, detalle: { sin_categoria: cuantas } });
        return { error: null, sinAnotar: Boolean(nota.error) };
      },
      (r) => {
        setAbiertaId(null);
        alAvisar('Categoría "' + cat.name + '" borrada' + (r && r.sinAnotar ? '; no se pudo anotar en Actividad' : ''));
      }
    );
  }

  return (
    <section className="ag-cats" aria-label="Categorías">
      <div className="ag-cat-nueva">
        <input
          className="ag-campo"
          type="text"
          aria-label="Nombre de la categoría nueva"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') agregar();
          }}
          placeholder="Nueva categoría..."
        />
        <label className="ag-cat-posicion">
          <span>Posición</span>
          <select className="ag-campo" value={posicion} onChange={(e) => setPosicion(e.target.value)}>
            {opcionesDePosicion(categorias.length).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ag-boton" onClick={agregar} disabled={ocupado}>
          Agregar
        </button>
      </div>

      {mensaje && (
        <p className="ag-nota alerta" role="status">
          {mensaje}
        </p>
      )}

      {categorias.length === 0 && <Vacio titulo="Aún no hay categorías" pista="Agrega la primera con el campo de arriba." />}

      {categorias.map((c, i) => {
        const abierta = abiertaId === c.id;
        return (
          <div key={c.id} className={'ag-cat' + (abierta ? ' abierta' : '')}>
            <div className="ag-cat-fila">
              <button type="button" className="ag-cat-cuerpo" onClick={() => abrir(c)} aria-expanded={abierta}>
                <i className={'ag-punto c' + tonoDe(i)} />
                <span className="ag-cat-orden">{c.priority_order}.º</span>
                <span className="ag-cat-texto">
                  <span className="ag-titulo">{c.name}</span>
                  <span className="ag-detalle">{textoAbiertos(abiertos.porId[c.id] || 0)}</span>
                </span>
              </button>
              <button type="button" className="ag-mini" onClick={() => ejecutar(() => moverCategoria(cliente, categorias, c, 'subir'))} disabled={ocupado || i === 0} aria-label={'Subir: ' + c.name}>
                ▲
              </button>
              <button type="button" className="ag-mini" onClick={() => ejecutar(() => moverCategoria(cliente, categorias, c, 'bajar'))} disabled={ocupado || i === categorias.length - 1} aria-label={'Bajar: ' + c.name}>
                ▼
              </button>
            </div>

            {abierta && (
              <div className="ag-cat-edicion">
                <label className="ag-etq" htmlFor={'cat-descripcion-' + c.id}>
                  Descripción
                </label>
                <textarea
                  id={'cat-descripcion-' + c.id}
                  className="ag-campo ancho"
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="De qué va esta categoría, sus objetivos, su situación..."
                />
                <button
                  type="button"
                  className="ag-boton principal"
                  onClick={() => ejecutar(() => guardarDescripcion(cliente, c.id, descripcion), () => { setAbiertaId(null); alAvisar('Descripción guardada'); })}
                  disabled={ocupado}
                >
                  Guardar descripción
                </button>
                <button type="button" className="ag-enlace peligro" onClick={() => borrar(c)} disabled={ocupado}>
                  Borrar esta categoría
                </button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
