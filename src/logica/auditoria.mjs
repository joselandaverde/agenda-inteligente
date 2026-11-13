// Registro de acciones delicadas (bloque 0-D, SEG-05). Funciones puras, con
// pruebas. Arman cada renglón del registro y lo traducen a lenguaje llano.
// Regla: el registro nunca guarda contenido (títulos, notas, texto dictado).

export const ACCIONES = {
  RESPALDO_DESCARGAR: 'respaldo.descargar',
  RESPALDO_RESTAURAR: 'respaldo.restaurar',
  COMPROMISO_BORRAR: 'compromiso.borrar',
  CATEGORIA_BORRAR: 'categoria.borrar',
  IA_INTERPRETAR: 'ia.interpretar',
};

const RESULTADOS = ['ok', 'error', 'rechazado'];
const NOMBRES_BASE = { produccion: 'producción', pruebas: 'pruebas' };
const TIPOS = ['Tarea', 'Reunión', 'Recordatorio'];

const corto = (valor, maximo) => String(valor === null || valor === undefined ? '' : valor).slice(0, maximo);
const entero = (valor) => (Number.isInteger(valor) && valor >= 0 ? valor : null);

/**
 * Deja pasar solo los datos previstos y con forma conocida. Lo que no está en
 * esta lista no llega al registro, aunque alguien lo mande.
 */
export function limpiarDetalle(detalle) {
  const d = detalle && typeof detalle === 'object' ? detalle : {};
  const limpio = {};

  if (d.cantidades && typeof d.cantidades === 'object') {
    const c = {};
    for (const tabla of ['projects', 'tasks', 'subtasks']) {
      const n = entero(d.cantidades[tabla]);
      if (n !== null) c[tabla] = n;
    }
    if (Object.keys(c).length > 0) limpio.cantidades = c;
  }
  for (const clave of ['origen', 'destino']) {
    if (Object.prototype.hasOwnProperty.call(NOMBRES_BASE, d[clave])) limpio[clave] = d[clave];
  }
  if (TIPOS.includes(d.tipo)) limpio.tipo = d.tipo;
  if (entero(d.sin_categoria) !== null) limpio.sin_categoria = d.sin_categoria;
  if (entero(d.ms) !== null) limpio.ms = d.ms;
  // El motivo es un código de la app (por ejemplo "limite_excedido"), nunca texto libre.
  if (typeof d.motivo === 'string' && /^[a-z0-9_]{1,40}$/.test(d.motivo)) limpio.motivo = d.motivo;
  return limpio;
}

/** "I-4 · 3d134ed": versión visible de la app y commit, si se conoce. */
export function versionCorta(versionApp, commit) {
  const c = typeof commit === 'string' ? commit.trim().slice(0, 7) : '';
  return corto([versionApp, c].filter(Boolean).join(' · '), 60) || null;
}

/** Arma el renglón que se guarda. Devuelve null si la acción no es válida. */
export function armarRenglon({ accion, recurso = null, resultado = 'ok', detalle = {}, version = null, actor = 'app' } = {}) {
  if (typeof accion !== 'string' || !accion.trim()) return null;
  return {
    actor: actor === 'servidor' ? 'servidor' : 'app',
    action: corto(accion.trim(), 60),
    resource: recurso ? corto(recurso, 120) : null,
    result: RESULTADOS.includes(resultado) ? resultado : 'error',
    detail: limpiarDetalle(detalle),
    app_version: version ? corto(version, 60) : null,
  };
}

const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

function textoCantidades(c) {
  if (!c) return '';
  return plural(c.projects || 0, 'categoría', 'categorías') + ', ' + plural(c.tasks || 0, 'compromiso', 'compromisos') + ' y ' + plural(c.subtasks || 0, 'subtarea', 'subtareas');
}

const MOTIVOS_IA = {
  limite_excedido: 'se alcanzó el límite por hora',
  limite_no_disponible: 'el control de uso no respondió',
  ia_no_disponible: 'la IA no respondió',
  ia_formato: 'la IA respondió con un formato que no se pudo leer',
  texto_largo: 'el texto era demasiado largo',
  sin_texto: 'no había texto',
};

/**
 * Traduce un renglón a lenguaje llano. Devuelve { titulo, detalle, alerta }.
 * Una acción desconocida se muestra con su nombre, sin fallar.
 */
export function describir(renglon) {
  const r = renglon || {};
  const d = r.detail && typeof r.detail === 'object' ? r.detail : {};
  const bien = r.result === 'ok';
  const alerta = !bien;

  switch (r.action) {
    case ACCIONES.RESPALDO_DESCARGAR:
      return { titulo: bien ? 'Descargaste un respaldo' : 'No se pudo descargar un respaldo', detalle: textoCantidades(d.cantidades), alerta };
    case ACCIONES.RESPALDO_RESTAURAR: {
      const partes = [textoCantidades(d.cantidades)];
      if (d.origen && d.destino && d.origen !== d.destino) {
        partes.push('el archivo venía de la base de ' + NOMBRES_BASE[d.origen] + ' y se restauró en ' + NOMBRES_BASE[d.destino]);
      } else if (d.origen) {
        partes.push('archivo de la base de ' + NOMBRES_BASE[d.origen]);
      }
      return { titulo: bien ? 'Restauraste un respaldo' : 'Una restauración no se completó', detalle: partes.filter(Boolean).join(' · '), alerta };
    }
    case ACCIONES.COMPROMISO_BORRAR:
      return { titulo: 'Borraste ' + (d.tipo === 'Reunión' ? 'una reunión' : d.tipo === 'Recordatorio' ? 'un recordatorio' : d.tipo === 'Tarea' ? 'una tarea' : 'un compromiso'), detalle: '', alerta };
    case ACCIONES.CATEGORIA_BORRAR:
      return {
        titulo: 'Borraste una categoría',
        detalle: d.sin_categoria ? plural(d.sin_categoria, 'compromiso quedó', 'compromisos quedaron') + ' sin categoría' : '',
        alerta,
      };
    case ACCIONES.IA_INTERPRETAR:
      if (bien) return { titulo: 'Interpretación con IA', detalle: '', alerta: false };
      return {
        titulo: r.result === 'rechazado' ? 'Interpretación con IA rechazada' : 'Interpretación con IA fallida',
        detalle: MOTIVOS_IA[d.motivo] || '',
        alerta: true,
      };
    default:
      return { titulo: r.action ? String(r.action) : 'Acción desconocida', detalle: '', alerta };
  }
}

/** "12 nov, 10:15 p. m.": fecha y hora locales de un renglón. */
export function cuandoFue(iso, ahora = new Date()) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const h = t.getHours();
  const hora = (h % 12 === 0 ? 12 : h % 12) + ':' + String(t.getMinutes()).padStart(2, '0') + (h >= 12 ? ' p. m.' : ' a. m.');
  const mismoDia = t.getFullYear() === ahora.getFullYear() && t.getMonth() === ahora.getMonth() && t.getDate() === ahora.getDate();
  if (mismoDia) return 'hoy, ' + hora;
  const anio = t.getFullYear() !== ahora.getFullYear() ? ' de ' + t.getFullYear() : '';
  return t.getDate() + ' ' + meses[t.getMonth()] + anio + ', ' + hora;
}
