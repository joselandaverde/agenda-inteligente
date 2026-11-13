"""Genera la carga inicial de tareas (bloque 1-A) a partir del Excel de priorización.

Lee la hoja "Tareas", valida cada renglón contra su catálogo y escribe, en una
carpeta FUERA del repositorio, tres textos para el editor de SQL de Supabase:

    1_carga.sql      crea las categorías que falten y carga las tareas
    2_comprobar.sql  solo lectura: cantidades por área y huella de lo cargado
    3_deshacer.sql   borra exactamente las tareas de esta carga

En pantalla solo muestra cantidades, números de renglón y la huella esperada:
nunca el texto de las tareas. La huella de 2_comprobar.sql debe ser igual a la
que imprime este programa; si lo es, cada campo llegó como está en el Excel.

Uso:
    python generar_carga.py <excel> <carpeta_de_salida> [--cuenta <uuid>]

Sin --cuenta, la carga exige que la base tenga exactamente una cuenta y usa
esa (producción). Con --cuenta se carga en la cuenta indicada (base de pruebas).

Los archivos generados contienen datos reales: no se versionan.
"""
import datetime
import hashlib
import os
import sys
import uuid

from openpyxl import load_workbook

HOJA = 'Tareas'
ENCABEZADOS = ['ID', 'Área', 'Grupo', 'Tarea', 'E+ (0-2)', 'E− (0-2)', 'P (0-2)', 'Personal (0-2)', 'Urgencia',
               'Fecha límite', '% Avance', 'Retomar el', 'Esfuerzo', 'Delegable', '¿Me esperan?', 'Completado',
               'Puntaje', 'Orden sugerido', 'Clave', 'Notas']
AREAS = ['Trabajo', 'Personal', 'Proyectos']
URGENCIAS = ['Fecha dura', 'Ventana', 'Sin fecha']
ESFUERZOS = ['Rápido', 'Medio', 'Grande']
DELEGABLES = ['Solo yo', 'Parcial', 'Delegable']
SI_NO = ['Sí', 'No']


class ErrorDeCarga(Exception):
    pass


def texto(valor):
    return '' if valor is None else str(valor).strip()


def fecha(valor, renglon, columna, problemas):
    if valor in (None, ''):
        return None
    if isinstance(valor, datetime.datetime):
        return valor.date()
    if isinstance(valor, datetime.date):
        return valor
    problemas.append('renglón %d: "%s" no es una fecha' % (renglon, columna))
    return None


def catalogo(valor, opciones, renglon, columna, problemas, obligatorio=False):
    v = texto(valor)
    if not v:
        if obligatorio:
            problemas.append('renglón %d: falta "%s"' % (renglon, columna))
        return None
    if v not in opciones:
        problemas.append('renglón %d: "%s" fuera de catálogo' % (renglon, columna))
        return None
    return v


def numero(valor, renglon, columna, problemas, minimo=None, maximo=None, entero=False, obligatorio=True):
    if valor in (None, ''):
        if obligatorio:
            problemas.append('renglón %d: falta "%s"' % (renglon, columna))
        return None
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        problemas.append('renglón %d: "%s" no es un número' % (renglon, columna))
        return None
    if entero and int(valor) != valor:
        problemas.append('renglón %d: "%s" no es un entero' % (renglon, columna))
        return None
    if (minimo is not None and valor < minimo) or (maximo is not None and valor > maximo):
        problemas.append('renglón %d: "%s" fuera de rango' % (renglon, columna))
        return None
    return int(valor) if entero else float(valor)


def leer_excel(ruta):
    """Devuelve la lista de tareas ya validadas. Lanza ErrorDeCarga si algo no cuadra."""
    libro = load_workbook(ruta, data_only=True)
    if HOJA not in libro.sheetnames:
        raise ErrorDeCarga('El archivo no tiene la hoja "%s".' % HOJA)
    hoja = libro[HOJA]

    fila_enc = None
    for r in range(1, min(hoja.max_row, 15) + 1):
        if [texto(c.value) for c in hoja[r]][:len(ENCABEZADOS)] == ENCABEZADOS:
            fila_enc = r
            break
    if fila_enc is None:
        raise ErrorDeCarga('No se encontró el renglón de encabezados esperado en la hoja "%s".' % HOJA)

    problemas, tareas, vistos, titulos = [], [], set(), set()
    for r in range(fila_enc + 1, hoja.max_row + 1):
        f = {ENCABEZADOS[i]: hoja.cell(r, i + 1).value for i in range(len(ENCABEZADOS))}
        if not texto(f['Tarea']):
            if f['ID'] not in (None, ''):
                problemas.append('renglón %d: tiene ID pero no tiene nombre de tarea' % r)
            continue

        ident = numero(f['ID'], r, 'ID', problemas, minimo=1, entero=True)
        if ident is not None:
            if ident in vistos:
                problemas.append('renglón %d: ID repetido' % r)
            vistos.add(ident)
        titulo = texto(f['Tarea'])
        if len(titulo) > 255:
            problemas.append('renglón %d: el nombre de la tarea pasa de 255 caracteres' % r)
        if titulo.lower() in titulos:
            problemas.append('renglón %d: nombre de tarea repetido' % r)
        titulos.add(titulo.lower())
        grupo = texto(f['Grupo'])
        if len(grupo) > 80:
            problemas.append('renglón %d: el grupo pasa de 80 caracteres' % r)
        avance = numero(f['% Avance'], r, '% Avance', problemas, minimo=0, maximo=100, obligatorio=False)

        tareas.append({
            'renglon': r,
            'num': ident,
            'area': catalogo(f['Área'], AREAS, r, 'Área', problemas, obligatorio=True),
            'grupo': grupo or None,
            'titulo': titulo,
            'generar': numero(f['E+ (0-2)'], r, 'E+', problemas, 0, 2, entero=True),
            'proteger': numero(f['E− (0-2)'], r, 'E−', problemas, 0, 2, entero=True),
            'politico': numero(f['P (0-2)'], r, 'P', problemas, 0, 2, entero=True),
            'personal': numero(f['Personal (0-2)'], r, 'Personal', problemas, 0, 2, entero=True),
            'urgencia': catalogo(f['Urgencia'], URGENCIAS, r, 'Urgencia', problemas),
            'limite': fecha(f['Fecha límite'], r, 'Fecha límite', problemas),
            'avance': int(round(avance)) if avance is not None else 0,
            'retomar': fecha(f['Retomar el'], r, 'Retomar el', problemas),
            'esfuerzo': catalogo(f['Esfuerzo'], ESFUERZOS, r, 'Esfuerzo', problemas),
            'delegable': catalogo(f['Delegable'], DELEGABLES, r, 'Delegable', problemas),
            'me_esperan': catalogo(f['¿Me esperan?'], SI_NO, r, '¿Me esperan?', problemas),
            'completado': catalogo(f['Completado'], SI_NO, r, 'Completado', problemas) == 'Sí',
            'puntaje': numero(f['Puntaje'], r, 'Puntaje', problemas, minimo=0, maximo=9999),
            'orden': numero(f['Orden sugerido'], r, 'Orden sugerido', problemas, minimo=0, maximo=9999),
            'notas': texto(f['Notas']) or None,
        })

    if not tareas:
        problemas.append('la hoja no tiene ninguna tarea')
    if problemas:
        raise ErrorDeCarga('El Excel tiene %d problema(s):\n  ' % len(problemas) + '\n  '.join(problemas))
    return sorted(tareas, key=lambda t: t['num'])


# ---------- huella: la misma receta aquí y en 2_comprobar.sql ----------

def decimales(valor):
    return '%.4f' % round(valor, 4)


def linea_de_huella(t):
    """Una tarea como texto: mismos campos, mismo orden y mismo formato que en SQL."""
    campos = [
        'excel:%d' % t['num'],
        t['area'],
        t['grupo'] or '',
        t['titulo'],
        str(t['generar']), str(t['proteger']), str(t['politico']), str(t['personal']),
        t['urgencia'] or '',
        t['limite'].isoformat() if t['limite'] else '',
        str(t['avance']),
        t['retomar'].isoformat() if t['retomar'] else '',
        t['esfuerzo'] or '',
        t['delegable'] or '',
        {None: '', 'Sí': 'si', 'No': 'no'}[t['me_esperan']],
        'Hecho' if t['completado'] else 'Pendiente',
        decimales(t['puntaje']),
        decimales(t['orden']),
        t['notas'] or '',
    ]
    return '|'.join(campos)


def huella(tareas):
    cuerpo = '\n'.join(linea_de_huella(t) for t in tareas)
    return hashlib.md5(cuerpo.encode('utf-8')).hexdigest()


SQL_LINEA_HUELLA = """concat_ws('|',
      t.origen,
      coalesce(p.name, ''),
      coalesce(t.grupo, ''),
      t.title,
      t.impact_generar::text, t.impact_proteger::text, t.impact_politico::text, t.impact_personal::text,
      coalesce(t.urgency_category, ''),
      coalesce(to_char(t.deadline, 'YYYY-MM-DD'), ''),
      coalesce(t.progress, 0)::text,
      coalesce(to_char(t.retomar_el, 'YYYY-MM-DD'), ''),
      coalesce(t.esfuerzo, ''),
      coalesce(t.delegable, ''),
      case when t.me_esperan is null then '' when t.me_esperan then 'si' else 'no' end,
      case when t.state = 'Hecho' then 'Hecho' else 'Pendiente' end,
      to_char(t.puntaje, 'FM99990.0000'),
      to_char(t.orden_sugerido, 'FM99990.0000'),
      coalesce(t.notes, ''))"""


# ---------- textos SQL ----------

def sql_texto(valor):
    if valor is None:
        return 'null'
    return "'" + str(valor).replace("'", "''") + "'"


def sql_fecha(valor):
    return 'null' if valor is None else "date '%s'" % valor.isoformat()


def sql_bool(valor):
    return {None: 'null', 'Sí': 'true', 'No': 'false'}[valor]


def sql_carga(tareas, lote, cuenta):
    areas = [a for a in AREAS if any(t['area'] == a for t in tareas)]
    filas = []
    for t in tareas:
        filas.append("    (u, c_%s, 'Tarea', %s, %s, %d, %d, %d, %d, %s, %s, %d, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)" % (
            t['area'].lower(), sql_texto(t['titulo']), sql_texto(t['grupo']),
            t['generar'], t['proteger'], t['politico'], t['personal'],
            sql_texto(t['urgencia']), sql_fecha(t['limite']), t['avance'], sql_fecha(t['retomar']),
            sql_texto(t['esfuerzo']), sql_texto(t['delegable']), sql_bool(t['me_esperan']),
            "'Hecho'" if t['completado'] else "'Pendiente'",
            'now()' if t['completado'] else 'null',
            decimales(t['puntaje']), decimales(t['orden']), sql_texto(t['notas']),
            sql_texto('excel:%d' % t['num']), 'lote'))

    if cuenta:
        elegir_cuenta = """  u := '%s';
  if not exists (select 1 from auth.users where id = u) then
    raise exception 'La cuenta indicada no existe en esta base';
  end if;""" % cuenta
    else:
        elegir_cuenta = """  select count(*) into n from auth.users;
  if n <> 1 then
    raise exception 'Esta carga es para una base con una sola cuenta y aquí hay %: no se cargó nada', n;
  end if;
  select id into u from auth.users;"""

    categorias = ''
    for a in areas:
        categorias += """
  select id into c_%(v)s from public.projects where user_id = u and name = %(n)s;
  if c_%(v)s is null then
    insert into public.projects (user_id, name, priority_order)
    values (u, %(n)s, (select coalesce(max(priority_order), 0) + 1 from public.projects where user_id = u))
    returning id into c_%(v)s;
  end if;
""" % {'v': a.lower(), 'n': sql_texto(a)}

    return """-- Agenda Inteligente · bloque 1-A · carga inicial de tareas
-- Generado por herramientas/generar_carga.py. Contiene datos reales: no versionar.
-- Todo o nada: si algo falla, no entra ninguna tarea. Pegarlo dos veces no duplica.

do $$
declare
  u uuid;
  lote uuid := '%(lote)s';
  n integer;
%(vars)s
begin
%(cuenta)s
%(categorias)s
  insert into public.tasks (
    user_id, project_id, type, title, grupo,
    impact_generar, impact_proteger, impact_politico, impact_personal,
    urgency_category, deadline, progress, retomar_el,
    esfuerzo, delegable, me_esperan, state, date_completed,
    puntaje, orden_sugerido, notes, origen, lote_carga)
  values
%(filas)s
  on conflict (user_id, origen) where origen is not null do nothing;
  get diagnostics n = row_count;
  raise notice 'Tareas cargadas en esta ejecución: %%', n;
end $$;

%(comprobar)s""" % {
        'lote': lote,
        'vars': '\n'.join('  c_%s uuid;' % a.lower() for a in areas),
        'cuenta': elegir_cuenta,
        'categorias': categorias,
        'filas': ',\n'.join(filas),
        'comprobar': sql_comprobar(lote, encabezado=False),
    }


def sql_comprobar(lote, encabezado=True):
    cabeza = """-- Agenda Inteligente · bloque 1-A · comprobación de la carga (solo lectura)
-- La huella debe ser igual a la que imprimió herramientas/generar_carga.py.

""" if encabezado else '-- Comprobación (solo lectura): cantidades por área y huella de lo cargado.\n'
    return cabeza + """select
  count(*) as tareas,
  count(*) filter (where p.name = 'Trabajo') as trabajo,
  count(*) filter (where p.name = 'Personal') as personal,
  count(*) filter (where p.name = 'Proyectos') as proyectos,
  count(distinct t.user_id) as cuentas,
  md5(string_agg(
    %(linea)s,
    E'\\n' order by substring(t.origen from 7)::integer)) as huella
from public.tasks t
left join public.projects p on p.id = t.project_id
where t.lote_carga = '%(lote)s';
""" % {'linea': SQL_LINEA_HUELLA, 'lote': lote}


def sql_deshacer(lote):
    return """-- Agenda Inteligente · bloque 1-A · deshacer la carga
-- BORRA exactamente las tareas de esta carga (y sus subtareas, si se les
-- agregaron). No toca otras tareas ni las categorías. No se puede deshacer.

with borradas as (
  delete from public.tasks where lote_carga = '%s' returning 1
)
select count(*) as tareas_borradas from borradas;
""" % lote


def principal(argumentos):
    cuenta = None
    if '--cuenta' in argumentos:
        i = argumentos.index('--cuenta')
        cuenta = str(uuid.UUID(argumentos[i + 1]))
        argumentos = argumentos[:i] + argumentos[i + 2:]
    if len(argumentos) != 2:
        print(__doc__)
        return 2
    excel, salida = argumentos
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if os.path.commonpath([os.path.abspath(salida), repo]) == repo:
        print('La carpeta de salida no puede estar dentro del repositorio: los archivos llevan datos reales.')
        return 2

    try:
        tareas = leer_excel(excel)
    except ErrorDeCarga as e:
        print(e)
        return 1

    lote = str(uuid.uuid4())
    os.makedirs(salida, exist_ok=True)
    for nombre, contenido in (('1_carga.sql', sql_carga(tareas, lote, cuenta)),
                              ('2_comprobar.sql', sql_comprobar(lote)),
                              ('3_deshacer.sql', sql_deshacer(lote))):
        with open(os.path.join(salida, nombre), 'w', encoding='utf-8', newline='\n') as f:
            f.write(contenido)

    por_area = {a: sum(1 for t in tareas if t['area'] == a) for a in AREAS}
    print('Tareas leídas y validadas: %d' % len(tareas))
    print('Por área: ' + ', '.join('%s %d' % (a, n) for a, n in por_area.items()))
    print('Lote de la carga: %s' % lote)
    print('Destino: %s' % ('la cuenta %s' % cuenta if cuenta else 'la única cuenta de la base'))
    print('HUELLA ESPERADA: %s' % huella(tareas))
    print('Archivos escritos en: %s' % os.path.abspath(salida))
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(principal(sys.argv[1:]))
