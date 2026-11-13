import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Icono from '../componentes/Icono';
import { Hoja } from '../componentes/Armazon';
import CamposPrioridad from '../componentes/CamposPrioridad';
import { guardarCompromiso } from '../datos/compromisos';
import { fechaLocalISO } from '../logica/agenda.mjs';
import { explicarPuntaje } from '../logica/puntaje.mjs';
import { tareaConPrioridad } from '../logica/prioridad.mjs';
import {
  TIPOS, REPETICIONES, IMPORTANCIAS, CANALES, HORAS, MINUTOS,
  formularioDelDia, armarCompromiso, formularioInterpretado, mensajeDeRespuesta, esDudoso, lineasDe, llevaFechaHora,
} from '../logica/compromiso.mjs';

// Un renglón del formulario: ícono, nombre del dato y su control a la derecha.
// Si la IA no pudo interpretar ese dato, el renglón queda resaltado.
function Opcion({ icono, etiqueta, dudoso, children }) {
  return (
    <div className={'ag-opcion' + (dudoso ? ' dudoso' : '')}>
      <Icono nombre={icono} />
      <span className="ag-opcion-etq">{etiqueta}</span>
      <span className="ag-opcion-valor">{children}</span>
    </div>
  );
}

function Interruptor({ activo, alCambiar, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} className={'ag-interruptor' + (activo ? ' activo' : '')} onClick={() => alCambiar(!activo)}>
      <span />
    </button>
  );
}

// `fechaInicial` (AAAA-MM-DD) llega cuando se captura desde la columna de un
// día en la vista de computadora: el compromiso nace con esa fecha.
export default function Capturar({ categorias, fechaInicial, alGuardar, alCerrar }) {
  const [f, setF] = useState(() => formularioDelDia(fechaLocalISO(), fechaInicial));
  const [textoLibre, setTextoLibre] = useState('');
  const [interpretando, setInterpretando] = useState(false);
  const [mensajeIA, setMensajeIA] = useState('');
  const [dudosos, setDudosos] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [masOpciones, setMasOpciones] = useState(false);
  const [pegarLista, setPegarLista] = useState(false);

  const poner = (cambios) => setF((previo) => ({ ...previo, ...cambios }));
  // Al corregir a mano un dato que la IA no entendió, deja de marcarse.
  const corregir = (dato, cambios) => {
    poner(cambios);
    setDudosos((lista) => lista.filter((a) => !esDudoso([a], dato)));
  };

  const esTarea = f.tipo === 'Tarea';
  const dividida = esTarea && f.tendraSubtareas;
  const conFecha = llevaFechaHora(f);

  // Puntaje de la tarea con lo que hay en pantalla, para que se vea al calificar.
  const puntaje = esTarea ? explicarPuntaje(tareaConPrioridad({}, { ...f.prioridad, fechaLimite: f.tieneFechaLimite ? f.fechaLimite : '' }), fechaLocalISO()) : null;

  // Manda el texto (dictado o escrito) a la función de IA y, con la respuesta,
  // llena el formulario para que el usuario revise y confirme.
  async function interpretar() {
    if (!textoLibre.trim()) {
      setMensajeIA('Escribe o dicta algo primero.');
      return;
    }
    setInterpretando(true);
    setMensajeIA('Interpretando...');
    setDudosos([]);

    try {
      // El servidor exige la sesión del usuario y recibe la fecha local del
      // teléfono para resolver "mañana", "el viernes", etc.
      const { data: sesionActual } = await supabase.auth.getSession();
      const token = sesionActual?.session?.access_token;
      if (!token) {
        setMensajeIA(mensajeDeRespuesta(401));
        setInterpretando(false);
        return;
      }
      const zonaHoraria = Intl.DateTimeFormat().resolvedOptions().timeZone || null;

      const respuesta = await fetch('/api/interpretar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        // Decisión #49: a la IA se le envían los nombres de las categorías, y
        // nada más, para que pueda elegir una.
        body: JSON.stringify({ texto: textoLibre, fechaLocal: fechaLocalISO(), zonaHoraria, categorias: categorias.map((c) => c.name) }),
      });

      if (!respuesta.ok) {
        setMensajeIA(mensajeDeRespuesta(respuesta.status));
        setInterpretando(false);
        return;
      }

      // Cada interpretación reemplaza el formulario completo: no se mezcla
      // con lo que dejó la anterior ni con lo tecleado antes.
      const { formulario, advertencias, abrirMas } = formularioInterpretado(fechaLocalISO(), await respuesta.json(), { categorias, fechaInicial });
      setF(formulario);
      setDudosos(advertencias);
      setMasOpciones(abrirMas);
      setPegarLista(false);
      setMensaje('');
      setMensajeIA(
        advertencias.length > 0
          ? 'No pude interpretar: ' + advertencias.join(', ') + '. Ese dato no se llenó: complétalo antes de crear.'
          : 'Listo. Revisa los datos antes de crear.'
      );
      setTextoLibre('');
    } catch (error) {
      setMensajeIA('Error al conectar con la IA. Intenta de nuevo.');
    }
    setInterpretando(false);
  }

  function agregarSubtarea() {
    if (!f.nuevaSubtareaTitulo.trim()) return;
    const tiempo = parseInt(f.nuevaSubtareaTiempo, 10);
    if (isNaN(tiempo) || tiempo <= 0) {
      setMensaje('El tiempo estimado de la subtarea es obligatorio.');
      return;
    }
    setMensaje('');
    poner({ subtareas: [...f.subtareas, { titulo: f.nuevaSubtareaTitulo.trim(), tiempo }], nuevaSubtareaTitulo: '', nuevaSubtareaTiempo: '30' });
  }

  function agregarLista() {
    const lineas = lineasDe(f.textoLista);
    if (lineas.length === 0) {
      setMensaje('Pega al menos una línea de texto.');
      return;
    }
    const tiempo = parseInt(f.tiempoLista, 10);
    if (isNaN(tiempo) || tiempo <= 0) {
      setMensaje('El tiempo por subtarea es obligatorio.');
      return;
    }
    setMensaje('');
    poner({ subtareas: [...f.subtareas, ...lineas.map((l) => ({ titulo: l, tiempo }))], textoLista: '', tiempoLista: '30' });
    setPegarLista(false);
  }

  async function crear() {
    const r = armarCompromiso(f);
    if (r.error) {
      setMensaje(r.error);
      return;
    }
    // Si la IA no entendió la fecha o la hora y nadie las corrigió, no se
    // guarda en silencio el valor que quedó en pantalla: se pregunta.
    const sinRevisar = conFecha ? ['fecha', 'hora'].filter((dato) => esDudoso(dudosos, dato)) : [];
    if (sinRevisar.length > 0) {
      const ok = window.confirm(
        'No pude interpretar: ' + sinRevisar.join(' y ') + '. Si continúas, se guardará el ' + f.fecha + ' a las ' +
          f.hora12 + ':' + f.minutos + (f.ampm === 'AM' ? ' a. m.' : ' p. m.') + ' ¿Continuar?'
      );
      if (!ok) return;
    }
    if (r.confirmarRepeticion) {
      const ok = window.confirm(
        'Esta repetición no tiene fecha final: se repetirá indefinidamente hasta que la cambies. ¿Continuar?'
      );
      if (!ok) return;
    }
    setGuardando(true);
    setMensaje('');
    const { error } = await guardarCompromiso(supabase, r.datos, r.subtareas);
    setGuardando(false);
    if (error) {
      setMensaje('Error: ' + error.message);
      return;
    }
    alGuardar(r.subtareas.length > 0 ? 'Tarea y ' + r.subtareas.length + ' subtarea(s) guardadas' : 'Compromiso guardado');
  }

  const hayAviso = dudosos.length > 0;

  return (
    <Hoja titulo="Nuevo compromiso" alCerrar={alCerrar} textoCerrar="Cancelar">
      {/* Dictado: el micrófono del teclado escribe aquí */}
      <div className="ag-dictado">
        <textarea
          id="captura-texto"
          value={textoLibre}
          onChange={(e) => setTextoLibre(e.target.value)}
          placeholder="Dicta con el micrófono del teclado o escribe: “junta con el contador mañana a las 10”"
          aria-label="Texto para interpretar"
          rows={2}
        />
        <button type="button" className="ag-boton" onClick={interpretar} disabled={interpretando}>
          <Icono nombre="microfono" />
          {interpretando ? 'Interpretando...' : 'Interpretar con IA'}
        </button>
      </div>
      {mensajeIA && (
        <p className={'ag-nota' + (hayAviso ? ' alerta' : '')} role="status">
          {mensajeIA}
        </p>
      )}

      <label className="ag-etq" htmlFor="captura-titulo">
        Título
      </label>
      <input
        id="captura-titulo"
        className={'ag-campo ag-campo-titulo' + (esDudoso(dudosos, 'título') ? ' dudoso' : '')}
        type="text"
        value={f.titulo}
        onChange={(e) => corregir('título', { titulo: e.target.value })}
        placeholder="Escribe un título..."
      />

      <div className={'ag-segmentos' + (esDudoso(dudosos, 'tipo') ? ' dudoso' : '')} role="radiogroup" aria-label="Tipo de compromiso">
        {TIPOS.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={f.tipo === t} className={f.tipo === t ? 'activo' : ''} onClick={() => corregir('tipo', { tipo: t })}>
            {t}
          </button>
        ))}
      </div>

      <div className="ag-opciones">
        {esTarea && !dividida && (
          <Opcion icono="hoy" etiqueta="Tiene fecha y hora">
            <Interruptor activo={f.tieneFechaHora} alCambiar={(v) => poner({ tieneFechaHora: v })} etiqueta="Tiene fecha y hora definidas" />
          </Opcion>
        )}
        {esTarea && !dividida && !f.tieneFechaHora && (
          <p className="ag-ayuda">Sin fecha y hora, la tarea queda pendiente de agendar. Útil si lo importante es la fecha límite.</p>
        )}

        {conFecha && (
          <>
            <Opcion icono="hoy" etiqueta="Fecha" dudoso={esDudoso(dudosos, 'fecha')}>
              <input className="ag-campo" type="date" aria-label="Fecha" value={f.fecha} onChange={(e) => corregir('fecha', { fecha: e.target.value })} />
            </Opcion>
            <Opcion icono="reloj" etiqueta="Hora" dudoso={esDudoso(dudosos, 'hora')}>
              <span className="ag-hora-campos">
                <select className="ag-campo" aria-label="Hora" value={f.hora12} onChange={(e) => corregir('hora', { hora12: e.target.value })}>
                  {HORAS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                :
                <select className="ag-campo" aria-label="Minutos" value={f.minutos} onChange={(e) => corregir('hora', { minutos: e.target.value })}>
                  {(MINUTOS.includes(f.minutos) ? MINUTOS : [...MINUTOS, f.minutos].sort()).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select className="ag-campo" aria-label="AM o PM" value={f.ampm} onChange={(e) => corregir('hora', { ampm: e.target.value })}>
                  <option value="AM">a. m.</option>
                  <option value="PM">p. m.</option>
                </select>
              </span>
            </Opcion>
            <Opcion icono="repetir" etiqueta="Repetición" dudoso={esDudoso(dudosos, 'repetición')}>
              <select
                className="ag-campo"
                aria-label="Repetición"
                value={f.repeticion}
                onChange={(e) => corregir('repetición', e.target.value === 'Ninguna' ? { repeticion: 'Ninguna', repeticionTieneFin: false, repeticionFin: '' } : { repeticion: e.target.value })}
              >
                {REPETICIONES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Opcion>
            {f.repeticion !== 'Ninguna' && (
              <Opcion icono="repetir" etiqueta="Termina en una fecha">
                <Interruptor activo={f.repeticionTieneFin} alCambiar={(v) => poner({ repeticionTieneFin: v })} etiqueta="La repetición termina en una fecha" />
              </Opcion>
            )}
            {f.repeticion !== 'Ninguna' && f.repeticionTieneFin && (
              <Opcion icono="hoy" etiqueta="Repetir hasta">
                <input className="ag-campo" type="date" aria-label="Repetir hasta" value={f.repeticionFin} onChange={(e) => poner({ repeticionFin: e.target.value })} />
              </Opcion>
            )}
          </>
        )}

        {f.tipo !== 'Recordatorio' && !dividida && (
          <Opcion icono="cronometro" etiqueta={f.tipo === 'Reunión' ? 'Duración (minutos)' : 'Tiempo estimado (minutos)'} dudoso={esDudoso(dudosos, 'duración')}>
            <input className="ag-campo corto" type="number" inputMode="numeric" min="1" aria-label="Minutos" value={f.tiempoEstimado} onChange={(e) => corregir('duración', { tiempoEstimado: e.target.value })} />
          </Opcion>
        )}
        {dividida && <p className="ag-ayuda">El tiempo se calcula sumando las subtareas. Como cada una se agenda por separado, la tarea no lleva fecha, hora ni repetición propias.</p>}

        <Opcion icono="bandera" etiqueta="Importancia" dudoso={esDudoso(dudosos, 'importancia')}>
          <select className="ag-campo" aria-label="Importancia" value={f.importancia} onChange={(e) => corregir('importancia', { importancia: e.target.value })}>
            {IMPORTANCIAS.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.texto}
              </option>
            ))}
          </select>
        </Opcion>

        <Opcion icono="etiqueta" etiqueta="Categoría" dudoso={esDudoso(dudosos, 'categoría')}>
          <select className="ag-campo" aria-label="Categoría" value={f.categoria} onChange={(e) => corregir('categoría', { categoria: e.target.value })}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Opcion>

        <Opcion icono="campana" etiqueta="Avisarme" dudoso={esDudoso(dudosos, 'aviso')}>
          <Interruptor activo={f.quiereNotificacion} alCambiar={(v) => corregir('aviso', { quiereNotificacion: v })} etiqueta="Quiero que me avise" />
        </Opcion>
        {f.quiereNotificacion && (
          <>
            <Opcion icono="campana" etiqueta="Por dónde">
              <select className="ag-campo" aria-label="Canal del aviso" value={f.canalNotificacion} onChange={(e) => poner({ canalNotificacion: e.target.value })}>
                {CANALES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.texto}
                  </option>
                ))}
              </select>
            </Opcion>
            <Opcion icono="reloj" etiqueta="Minutos antes">
              <input className="ag-campo corto" type="number" inputMode="numeric" min="0" aria-label="Minutos antes" value={f.minutosAntes} onChange={(e) => poner({ minutosAntes: e.target.value })} />
            </Opcion>
            <p className="ag-ayuda">Por ahora solo se guarda tu preferencia. El envío real llegará más adelante.</p>
          </>
        )}
      </div>

      <button type="button" className="ag-mas" aria-expanded={masOpciones} onClick={() => setMasOpciones(!masOpciones)}>
        {masOpciones ? 'Menos opciones' : esTarea ? 'Más opciones: fecha límite, prioridad, subtareas, notas' : f.tipo === 'Reunión' ? 'Más opciones: lugar, participantes, notas' : 'Más opciones: notas'}
      </button>

      {masOpciones && (
        <div className="ag-opciones">
          {f.tipo === 'Reunión' && (
            <>
              <label className="ag-etq" htmlFor="captura-lugar">
                Lugar
              </label>
              <input id="captura-lugar" className={'ag-campo ancho' + (esDudoso(dudosos, 'lugar') ? ' dudoso' : '')} type="text" value={f.lugar} onChange={(e) => corregir('lugar', { lugar: e.target.value })} placeholder="Oficina, Zoom..." />
              <label className="ag-etq" htmlFor="captura-participantes">
                Participantes
              </label>
              <input id="captura-participantes" className={'ag-campo ancho' + (esDudoso(dudosos, 'participantes') ? ' dudoso' : '')} type="text" value={f.participantes} onChange={(e) => corregir('participantes', { participantes: e.target.value })} placeholder="Separados por comas" />
            </>
          )}

          {esTarea && (
            <>
              <Opcion icono="bandera" etiqueta="Tiene fecha límite" dudoso={esDudoso(dudosos, 'fecha límite')}>
                <Interruptor activo={f.tieneFechaLimite} alCambiar={(v) => corregir('fecha límite', { tieneFechaLimite: v })} etiqueta="Tiene fecha límite" />
              </Opcion>
              {f.tieneFechaLimite && (
                <Opcion icono="hoy" etiqueta="Fecha límite">
                  <input className="ag-campo" type="date" aria-label="Fecha límite" value={f.fechaLimite} onChange={(e) => poner({ fechaLimite: e.target.value })} />
                </Opcion>
              )}
              <div className="ag-prioridad">
                <span className="ag-etq">Prioridad (opcional)</span>
                <CamposPrioridad valores={f.prioridad} alCambiar={(cambios) => poner({ prioridad: { ...f.prioridad, ...cambios } })} />
                <p className="ag-ayuda">{puntaje && puntaje.puntaje !== null ? 'Puntaje: ' + puntaje.puntaje + '. ' + puntaje.texto + '.' : 'Sin puntaje todavía: califica al menos un impacto para que entre a las sugeridas.'}</p>
              </div>
              <Opcion icono="repetir" etiqueta="Reagendar si no la termino">
                <Interruptor activo={f.requiereConfirmacion} alCambiar={(v) => poner({ requiereConfirmacion: v })} etiqueta="Reagendar si no la marco como terminada" />
              </Opcion>
              <Opcion icono="lista" etiqueta="Dividir en subtareas" dudoso={esDudoso(dudosos, 'subtareas')}>
                <Interruptor activo={f.tendraSubtareas} alCambiar={(v) => corregir('subtareas', { tendraSubtareas: v })} etiqueta="La voy a dividir en subtareas" />
              </Opcion>

              {f.tendraSubtareas && (
                <div className="ag-subtareas">
                  {f.subtareas.map((s, i) => (
                    <div key={i} className="ag-subtarea">
                      <span className="ag-subtarea-num">{i + 1}.</span>
                      <span className="ag-subtarea-texto">{s.titulo}</span>
                      <span className="ag-duracion">{s.tiempo} min</span>
                      <button type="button" className="ag-quitar" aria-label={'Quitar ' + s.titulo} onClick={() => poner({ subtareas: f.subtareas.filter((_, j) => j !== i) })}>
                        ✕
                      </button>
                    </div>
                  ))}
                  {f.subtareas.length > 0 && <p className="ag-ayuda">Total: {f.subtareas.reduce((s, x) => s + x.tiempo, 0)} min</p>}

                  <div className="ag-subtarea-nueva">
                    <input className="ag-campo" type="text" aria-label="Nueva subtarea" value={f.nuevaSubtareaTitulo} onChange={(e) => poner({ nuevaSubtareaTitulo: e.target.value })} placeholder="Nueva subtarea..." />
                    <input className="ag-campo corto" type="number" inputMode="numeric" min="1" aria-label="Minutos de la subtarea" value={f.nuevaSubtareaTiempo} onChange={(e) => poner({ nuevaSubtareaTiempo: e.target.value })} />
                    <button type="button" className="ag-boton-secundario" onClick={agregarSubtarea}>
                      Agregar
                    </button>
                  </div>

                  <button type="button" className="ag-mas" aria-expanded={pegarLista} onClick={() => setPegarLista(!pegarLista)}>
                    {pegarLista ? 'Cerrar la lista' : 'Pegar una lista de subtareas'}
                  </button>
                  {pegarLista && (
                    <>
                      <label className="ag-etq" htmlFor="captura-lista">
                        Una subtarea por renglón
                      </label>
                      <textarea id="captura-lista" className="ag-campo ancho" rows={4} value={f.textoLista} onChange={(e) => poner({ textoLista: e.target.value })} placeholder={'Investigar proveedores\nComparar precios\nHacer pedido'} />
                      <div className="ag-subtarea-nueva">
                        <label className="ag-etq" htmlFor="captura-lista-min">
                          Minutos para cada una
                        </label>
                        <input id="captura-lista-min" className="ag-campo corto" type="number" inputMode="numeric" min="1" value={f.tiempoLista} onChange={(e) => poner({ tiempoLista: e.target.value })} />
                        <button type="button" className="ag-boton-secundario" onClick={agregarLista}>
                          Agregar la lista
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <label className="ag-etq" htmlFor="captura-notas">
            {f.tipo === 'Reunión' ? 'Comentarios o lo que se trató' : 'Notas'}
          </label>
          <textarea
            id="captura-notas"
            className={'ag-campo ancho' + (esDudoso(dudosos, 'notas') ? ' dudoso' : '')}
            rows={3}
            value={f.notas}
            onChange={(e) => corregir('notas', { notas: e.target.value })}
            placeholder={f.tipo === 'Reunión' ? 'Agenda, temas a tratar o lo que se acordó...' : 'Opcional'}
          />
        </div>
      )}

      {mensaje && (
        <p className="ag-nota alerta" role="alert">
          {mensaje}
        </p>
      )}
      {puntaje && (
        <p className="ag-puntaje-vivo" role="status">
          {puntaje.puntaje !== null ? (
            <>
              Puntaje de esta tarea: <strong>{puntaje.puntaje}</strong>
            </>
          ) : (
            'Puntaje: aún sin calificar (en "Más opciones", Prioridad)'
          )}
        </p>
      )}
      <button type="button" className="ag-boton principal" onClick={crear} disabled={guardando}>
        {guardando ? 'Guardando...' : 'Crear ' + f.tipo.toLowerCase()}
      </button>
    </Hoja>
  );
}
