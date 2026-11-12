// Sección de respaldo (bloque 0-C), dentro de la pantalla de Categorías.
// Descarga un archivo con todos los datos de la cuenta y lo restaura en una
// cuenta vacía. El archivo no va cifrado (decisión #50).
import React, { useRef, useState } from 'react';
import { VERSION_APP } from '../version.mjs';
import { armarRespaldo, nombreArchivo, leerArchivo, resumenCantidades, necesitaRespaldo, textoUltimoRespaldo, diasDesde } from '../logica/respaldo.mjs';
import { leerDatos, revisarAntesDeRestaurar, restaurar } from '../datos/respaldo.mjs';

const TAMANO_MAXIMO = 20 * 1024 * 1024;
const NOMBRES_BASE = { produccion: 'producción', pruebas: 'pruebas' };

// Fechas que se recuerdan en este equipo, por cuenta. Si el navegador no
// deja guardar (modo privado), la app sigue funcionando sin el recordatorio.
const clave = (usuarioId, cual) => 'agenda.respaldo.' + cual + '.' + usuarioId;

export function leerMarcas(usuarioId) {
  const leer = (cual) => {
    try {
      return window.localStorage.getItem(clave(usuarioId, cual));
    } catch (e) {
      return null;
    }
  };
  return { ultimo: leer('ultimo'), pospuesto: leer('pospuesto') };
}

export function guardarMarca(usuarioId, cual, iso) {
  try {
    window.localStorage.setItem(clave(usuarioId, cual), iso);
  } catch (e) {
    // sin almacenamiento: no se recuerda, nada más
  }
}

function entregarArchivo(nombre, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function fechaLegible(iso) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 'fecha desconocida';
  return t.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + t.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** Recordatorio breve para la pantalla de Hoy. */
export function AvisoRespaldo({ ultimo, alIr, alPosponer }) {
  const dias = diasDesde(ultimo);
  return (
    <div className="ag-recordatorio" role="status">
      <span>{dias === null ? 'Aún no has descargado un respaldo en este equipo.' : 'Tu último respaldo en este equipo fue hace ' + dias + ' días.'}</span>
      <span className="ag-recordatorio-acciones">
        <button type="button" className="ag-enlace" onClick={alIr}>
          Ir a respaldo
        </button>
        <button type="button" className="ag-enlace tenue" onClick={alPosponer}>
          Después
        </button>
      </span>
    </div>
  );
}

export default function Respaldo({ cliente, ultimo, hayDatos, alDescargar, alRestaurar }) {
  const [ocupado, setOcupado] = useState('');
  const [mensaje, setMensaje] = useState(null); // { tipo: 'bien' | 'alerta', texto }
  const [pendiente, setPendiente] = useState(null); // respaldo leído, en espera de confirmación
  const entrada = useRef(null);

  const decir = (tipo, texto) => setMensaje({ tipo, texto });

  async function descargar() {
    setOcupado('descargar');
    setMensaje(null);
    setPendiente(null);
    try {
      const { datos, error } = await leerDatos(cliente);
      if (error) {
        decir('alerta', 'No se pudo leer la cuenta: ' + error.message);
        return;
      }
      const respaldo = await armarRespaldo(datos, { versionApp: VERSION_APP, base: process.env.REACT_APP_BASE_DATOS || '' });
      if (respaldo.cantidades.projects + respaldo.cantidades.tasks + respaldo.cantidades.subtasks === 0) {
        decir('alerta', 'La cuenta está vacía: todavía no hay nada que respaldar.');
        return;
      }
      entregarArchivo(nombreArchivo(), JSON.stringify(respaldo, null, 2));
      alDescargar();
      decir('bien', 'Respaldo descargado: ' + resumenCantidades(respaldo.cantidades) + '. Comprueba que el archivo quedó en tus descargas y guárdalo donde solo tú tengas acceso.');
    } catch (e) {
      decir('alerta', 'No se pudo armar el respaldo: ' + (e && e.message ? e.message : 'error desconocido') + '.');
    } finally {
      setOcupado('');
    }
  }

  async function elegir(evento) {
    const archivo = evento.target.files && evento.target.files[0];
    evento.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    setMensaje(null);
    setPendiente(null);
    if (archivo.size > TAMANO_MAXIMO) {
      decir('alerta', 'El archivo es demasiado grande para ser un respaldo de la agenda.');
      return;
    }
    setOcupado('revisar');
    try {
      const { objeto, error } = leerArchivo(await archivo.text());
      if (error) {
        decir('alerta', error + ' No se escribió nada.');
        return;
      }
      const revision = await revisarAntesDeRestaurar(cliente, objeto);
      if (!revision.ok) {
        decir('alerta', revision.error + ' No se escribió nada.');
        return;
      }
      setPendiente({ objeto, nombre: archivo.name });
    } catch (e) {
      decir('alerta', 'No se pudo leer el archivo. No se escribió nada.');
    } finally {
      setOcupado('');
    }
  }

  async function confirmar() {
    const { objeto } = pendiente;
    setOcupado('restaurar');
    try {
      const r = await restaurar(cliente, objeto);
      setPendiente(null);
      if (r.ok) decir('bien', 'Restauración completa y comprobada: ' + resumenCantidades(r.cantidades) + '.');
      else decir('alerta', r.error);
    } catch (e) {
      setPendiente(null);
      decir('alerta', 'La restauración se interrumpió. Revisa la cuenta antes de volver a intentar.');
    } finally {
      setOcupado('');
      alRestaurar();
    }
  }

  const atrasado = necesitaRespaldo(ultimo, new Date(), hayDatos);

  return (
    <section className="ag-respaldo" aria-label="Respaldo">
      <h3>Respaldo</h3>
      <p className="ag-respaldo-texto">
        Descarga un archivo con todas tus categorías, compromisos y subtareas. El archivo no va cifrado: guárdalo donde solo tú tengas acceso.
      </p>
      <p className={'ag-nota' + (atrasado ? ' alerta' : '')}>
        {textoUltimoRespaldo(ultimo)}
        {atrasado ? ' Conviene descargar uno.' : ''}
      </p>

      <div className="ag-respaldo-botones">
        <button type="button" className="ag-boton" onClick={descargar} disabled={Boolean(ocupado)}>
          {ocupado === 'descargar' ? 'Preparando…' : 'Descargar respaldo'}
        </button>
        <button type="button" className="ag-boton-secundario" onClick={() => entrada.current && entrada.current.click()} disabled={Boolean(ocupado)}>
          {ocupado === 'revisar' ? 'Revisando…' : 'Restaurar desde archivo'}
        </button>
        <input ref={entrada} type="file" accept="application/json,.json" onChange={elegir} hidden aria-label="Archivo de respaldo" />
      </div>
      <p className="ag-respaldo-texto">Restaurar solo funciona en una cuenta vacía: nunca mezcla ni sobrescribe.</p>

      {pendiente && (
        <div className="ag-respaldo-confirmar">
          <p>
            <strong>{pendiente.nombre}</strong>
            <br />
            {resumenCantidades(pendiente.objeto.cantidades)}
            <br />
            Creado el {fechaLegible(pendiente.objeto.creado)}
            {NOMBRES_BASE[pendiente.objeto.base] ? ' · base de ' + NOMBRES_BASE[pendiente.objeto.base] : ''}
          </p>
          <div className="ag-respaldo-botones">
            <button type="button" className="ag-boton" onClick={confirmar} disabled={Boolean(ocupado)}>
              {ocupado === 'restaurar' ? 'Restaurando…' : 'Restaurar en esta cuenta'}
            </button>
            <button type="button" className="ag-boton-secundario" onClick={() => setPendiente(null)} disabled={Boolean(ocupado)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <p className={'ag-nota' + (mensaje.tipo === 'alerta' ? ' alerta' : ' bien')} role="status">
          {mensaje.texto}
        </p>
      )}
    </section>
  );
}
