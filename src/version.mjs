// Identificación visible de la versión de la app.
// VERSION_APP se cambia a mano en cada bloque; el entorno y el commit los
// aporta Vercel al compilar (variables REACT_APP_VERCEL_*) y la base de datos
// viene de REACT_APP_BASE_DATOS. Sin ellas, la etiqueta muestra solo la versión.
export const VERSION_APP = '0-D';

const NOMBRES_ENTORNO = {
  production: 'producción',
  preview: 'vista previa',
  development: 'desarrollo',
};

const NOMBRES_BASE = { produccion: 'producción', pruebas: 'pruebas' };

// Combinaciones que nunca deben ocurrir: la app publicada sobre la base de
// pruebas, o una vista previa sobre la base de producción.
function esCruzada(entorno, base) {
  return (entorno === 'production' && base === 'pruebas') ||
    (entorno !== 'production' && Boolean(NOMBRES_ENTORNO[entorno]) && base === 'produccion');
}

export function describirVersion({ entorno, commit, base } = {}) {
  const nombreEntorno = NOMBRES_ENTORNO[entorno] || '';
  const nombreBase = NOMBRES_BASE[base] || '';
  const commitCorto = typeof commit === 'string' ? commit.trim().slice(0, 7) : '';
  const cruzada = esCruzada(entorno, base);
  const texto = [
    'Versión ' + VERSION_APP,
    nombreEntorno,
    nombreBase ? 'base ' + nombreBase : '',
    commitCorto,
  ].filter(Boolean).join(' · ');
  return {
    texto,
    esProduccion: entorno === 'production',
    cruzada,
    nombreEntorno,
    nombreBase,
    commitCorto,
  };
}
