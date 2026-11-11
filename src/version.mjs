// Identificación visible de la versión de la app.
// VERSION_APP se cambia a mano en cada bloque; el entorno y el commit los
// aporta Vercel al compilar (variables REACT_APP_VERCEL_*). Sin ellas, la
// etiqueta muestra solo la versión.
export const VERSION_APP = '0-A';

const NOMBRES_ENTORNO = {
  production: 'producción',
  preview: 'vista previa',
  development: 'desarrollo',
};

export function describirVersion({ entorno, commit } = {}) {
  const nombreEntorno = NOMBRES_ENTORNO[entorno] || '';
  const commitCorto = typeof commit === 'string' ? commit.trim().slice(0, 7) : '';
  const texto = ['Versión ' + VERSION_APP, nombreEntorno, commitCorto].filter(Boolean).join(' · ');
  return { texto, esProduccion: entorno === 'production', nombreEntorno, commitCorto };
}
