import React, { useEffect } from 'react';
import Icono from './Icono';
import { partesDia } from '../logica/agenda.mjs';

// Piezas del armazón de la app: encabezado de pantalla, encabezado de cada
// grupo de la lista, barra inferior, botón de dictado, hoja y estado vacío.

export function Encabezado({ titulo, subtitulo, total, porcentaje, nota }) {
  return (
    <header className="ag-encabezado">
      <div className="ag-encabezado-fila">
        <div>
          <h1>{titulo}</h1>
          {subtitulo && <p className="ag-encabezado-sub">{subtitulo}</p>}
        </div>
        {total && (
          <span className="ag-total" title="Tiempo planeado">
            {total}
          </span>
        )}
      </div>
      {porcentaje !== null && porcentaje !== undefined && (
        <div className="ag-avance" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} aria-label="Avance del día">
          <span style={{ width: porcentaje + '%' }} />
        </div>
      )}
      {nota && <p className="ag-avance-nota">{nota}</p>}
    </header>
  );
}

export function EncabezadoDia({ grupo, hoyISO, extra }) {
  let numero = '';
  let nombre = '';
  let alerta = false;
  if (grupo.tipo === 'dia') {
    const p = partesDia(grupo.clave, hoyISO);
    numero = String(p.numero);
    nombre = p.nombre + (p.relativo ? ' · ' + p.relativo : ' · ' + p.mes);
  } else if (grupo.tipo === 'vencidos') {
    numero = 'Vencidos';
    alerta = true;
  } else if (grupo.tipo === 'sinFecha') {
    numero = 'Sin fecha';
  } else {
    numero = 'Hechos';
  }
  return (
    <h2 className={'ag-grupo-enc' + (alerta ? ' alerta' : '')} style={{ margin: 0 }}>
      <span className="ag-grupo-num">{numero}</span>
      {nombre && <span className="ag-grupo-nombre">{nombre}</span>}
      {extra && <span className="ag-grupo-extra">{extra}</span>}
    </h2>
  );
}

const DESTINOS = [
  { clave: 'hoy', texto: 'Hoy', icono: 'hoy' },
  { clave: 'proximos', texto: 'Próximos', icono: 'semana' },
  { clave: 'categorias', texto: 'Categorías', icono: 'etiqueta' },
];

export function BarraNavegacion({ pantalla, alCambiar }) {
  return (
    <nav className="ag-nav" aria-label="Secciones">
      {DESTINOS.map((d) => (
        <button key={d.clave} type="button" onClick={() => alCambiar(d.clave)} aria-current={pantalla === d.clave ? 'page' : undefined}>
          <Icono nombre={d.icono} />
          {d.texto}
        </button>
      ))}
    </nav>
  );
}

export function BotonDictar({ alPulsar }) {
  return (
    <button type="button" className="ag-dictar" onClick={alPulsar} aria-label="Nuevo compromiso: dictar o escribir">
      <Icono nombre="microfono" />
    </button>
  );
}

export function Hoja({ titulo, alCerrar, textoCerrar = 'Cerrar', children }) {
  // Mientras la hoja está abierta, la página de atrás no se desplaza.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  return (
    <div className="ag-hoja" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="ag-hoja-dentro">
        <div className="ag-hoja-cab">
          <h2>{titulo}</h2>
          <button type="button" className="ag-enlace" onClick={alCerrar}>
            {textoCerrar}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Vacio({ titulo, pista }) {
  return (
    <div className="ag-vacio">
      <strong>{titulo}</strong>
      {pista}
    </div>
  );
}
