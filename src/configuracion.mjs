// Configuración por ambiente (bloque 0-B).
// La app no trae direcciones ni llaves escritas en el código: cada ambiente
// (producción, vista previa) las recibe de sus variables de entorno. Si falta
// alguna, la app no se conecta a ninguna base (falla cerrado).

export const BASES = { produccion: 'producción', pruebas: 'pruebas' };

export const VARIABLES = {
  url: 'REACT_APP_SUPABASE_URL',
  llave: 'REACT_APP_SUPABASE_ANON_KEY',
  base: 'REACT_APP_BASE_DATOS',
};

function texto(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/** Una llave secreta de Supabase jamás debe llegar al navegador. */
export function esLlaveSecreta(llave) {
  const k = texto(llave);
  if (k.startsWith('sb_secret_')) return true;
  const partes = k.split('.');
  if (partes.length !== 3) return false;
  try {
    const carga = JSON.parse(globalThis.atob(partes[1].replace(/-/g, '+').replace(/_/g, '/')));
    return carga && carga.role === 'service_role';
  } catch {
    return false;
  }
}

export function leerConfiguracion({ url, llave, base } = {}) {
  const u = texto(url).replace(/\/+$/, '');
  const k = texto(llave);
  const b = texto(base).toLowerCase();
  const problemas = [];

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(u)) {
    problemas.push({ variable: VARIABLES.url, motivo: u ? 'no es una dirección de Supabase' : 'falta' });
  }
  if (!k) {
    problemas.push({ variable: VARIABLES.llave, motivo: 'falta' });
  } else if (esLlaveSecreta(k)) {
    problemas.push({ variable: VARIABLES.llave, motivo: 'es una llave secreta; aquí solo va la llave pública' });
  }
  if (!Object.hasOwn(BASES, b)) {
    problemas.push({ variable: VARIABLES.base, motivo: b ? 'debe ser "produccion" o "pruebas"' : 'falta' });
  }

  const ok = problemas.length === 0;
  return {
    ok,
    url: ok ? u : '',
    llave: ok ? k : '',
    base: Object.hasOwn(BASES, b) ? b : '',
    nombreBase: Object.hasOwn(BASES, b) ? BASES[b] : '',
    problemas,
  };
}
