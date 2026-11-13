"""Pruebas del generador de la carga (bloque 1-A), con un Excel inventado.

Arma en una carpeta temporal un libro con la misma estructura que el Excel de
priorización (hoja "Tareas", encabezados en el renglón 3) y comprueba que el
generador valida, rechaza lo que debe y escribe textos coherentes.

Uso:
    python probar_generar_carga.py                 corre las pruebas
    python probar_generar_carga.py <archivo.xlsx>  además deja ahí el Excel inventado

Todos los datos son inventados.
"""
import datetime
import os
import sys
import tempfile

from openpyxl import Workbook

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generar_carga as g  # noqa: E402

# (ID, Área, Grupo, Tarea, E+, E−, P, Personal, Urgencia, Fecha límite, % Avance,
#  Retomar el, Esfuerzo, Delegable, ¿Me esperan?, Completado, Puntaje, Orden, Clave, Notas)
INVENTADAS = [
    (1, 'Trabajo', 'Ensayo fiscal', 'Ensayo: preparar la declaración anual', 2, 2, 1, 0, 'Fecha dura', datetime.datetime(2026, 12, 15), 40, None, 'Grande', 'Parcial', 'Sí', None, 84.5, 84.52, 84.52001, 'Nota de ensayo: acentos, ñ y "comillas".'),
    (2, 'Trabajo', 'Ensayo fiscal', "Ensayo: revisar el contrato de O'Brien", 2, 1, 0, 0, None, None, None, None, None, None, None, None, 40, 40, 40.00002, None),
    (3, 'Trabajo', 'Ensayo clientes', 'Ensayo: llamar a tres clientes', 1, 1, 1, 0, 'Ventana', None, None, None, 'Rápido', 'Delegable', 'No', None, 40, 40, 40.00003, None),
    (4, 'Personal', 'Ensayo salud', 'Ensayo: agendar revisión médica', 0, 1, 0, 2, None, None, None, datetime.datetime(2027, 1, 10), None, 'Solo yo', None, None, 37.5, 37.5, 37.50004, None),
    (5, 'Personal', 'Ensayo casa', 'Ensayo: cotizar impermeabilización', 0, 2, 0, 1, 'Sin fecha', None, None, None, 'Medio', None, None, None, 25, 25, 25.00005, None),
    (6, 'Personal', 'Ensayo casa', 'Ensayo: tarea ya concluida   ', 0, 0, 0, 1, None, None, 100, None, None, None, None, 'Sí', 12.5, 12.5, 12.50006, None),
    (7, 'Proyectos', 'Ensayo agenda', 'Ensayo: definir el siguiente bloque; con punto y coma', 1, 0, 0, 1, None, None, None, None, None, None, None, 'No', 12.5, 12.5, 12.50007, None),
    (8, 'Trabajo', 'Ensayo clientes', 'Ensayo: enviar cotización', 1, 0, 1, 0, None, None, None, None, None, None, None, None, 25, 25, 25.00008, None),
]


def libro(filas, encabezados=None):
    wb = Workbook()
    wb.active.title = 'Hoy'
    ws = wb.create_sheet('Tareas')
    ws.cell(1, 1, 'Tareas (ensayo)')
    ws.cell(2, 1, 'Datos inventados')
    for i, e in enumerate(encabezados or g.ENCABEZADOS):
        ws.cell(3, i + 1, e)
    for r, fila in enumerate(filas):
        for c, valor in enumerate(fila):
            ws.cell(4 + r, c + 1, valor)
    # Como en el Excel real: renglones preparados, sin tarea y con la clave en -1.
    for r in range(4 + len(filas), 4 + len(filas) + 5):
        ws.cell(r, 19, -1)
    return wb


def guardar(wb, carpeta, nombre='ensayo.xlsx'):
    ruta = os.path.join(carpeta, nombre)
    wb.save(ruta)
    return ruta


def cambiar(fila, posicion, valor):
    nueva = list(fila)
    nueva[posicion] = valor
    return tuple(nueva)


def espera_error(carpeta, filas, fragmento, encabezados=None):
    try:
        g.leer_excel(guardar(libro(filas, encabezados), carpeta, 'malo.xlsx'))
    except g.ErrorDeCarga as e:
        assert fragmento in str(e), (fragmento, str(e))
        return
    raise AssertionError('debía rechazarse: ' + fragmento)


def pruebas(carpeta):
    ruta = guardar(libro(INVENTADAS), carpeta)
    tareas = g.leer_excel(ruta)

    # Lectura
    assert len(tareas) == 8
    assert [t['num'] for t in tareas] == list(range(1, 9))
    assert tareas[5]['titulo'] == 'Ensayo: tarea ya concluida', 'recorta espacios sobrantes'
    assert tareas[5]['completado'] is True and tareas[6]['completado'] is False and tareas[0]['completado'] is False
    assert tareas[0]['limite'] == datetime.date(2026, 12, 15) and tareas[3]['retomar'] == datetime.date(2027, 1, 10)
    assert tareas[0]['avance'] == 40 and tareas[1]['avance'] == 0
    assert tareas[0]['me_esperan'] == 'Sí' and tareas[2]['me_esperan'] == 'No' and tareas[1]['me_esperan'] is None

    # Huella: estable, y sensible a cualquier campo
    h = g.huella(tareas)
    assert h == g.huella(g.leer_excel(ruta)) and len(h) == 32
    for campo, valor in (('titulo', 'otro'), ('generar', 0), ('puntaje', 84.4999), ('grupo', None), ('notas', 'x'), ('limite', None), ('completado', True), ('area', 'Personal')):
        copia = [dict(t) for t in tareas]
        copia[0][campo] = valor
        assert g.huella(copia) != h, campo
    assert g.linea_de_huella(tareas[0]).startswith('excel:1|Trabajo|Ensayo fiscal|Ensayo: preparar la declaración anual|2|2|1|0|Fecha dura|2026-12-15|40||Grande|Parcial|si|Pendiente|84.5000|84.5200|')

    # Textos SQL
    lote = '11111111-2222-3333-4444-555555555555'
    carga = g.sql_carga(tareas, lote, None)
    assert carga.count("'Tarea'") == 8
    assert "O''Brien" in carga and "O'Brien" not in carga.replace("O''Brien", ''), 'escapa la comilla'
    assert "hay %: no se cargó nada" in carga, 'exige una sola cuenta'
    assert 'on conflict (user_id, origen) where origen is not null do nothing' in carga
    assert carga.count("'excel:") == 8 and "'excel:8', lote)" in carga
    assert all(('c_%s uuid;' % a) in carga for a in ('trabajo', 'personal', 'proyectos'))
    assert "'Hecho', now()" in carga and carga.count("'Pendiente', null") == 7
    assert "date '2026-12-15'" in carga and "date '2027-01-10'" in carga
    assert 'huella' in carga and lote in carga
    con_cuenta = g.sql_carga(tareas, lote, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    assert "u := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';" in con_cuenta and 'una sola cuenta' not in con_cuenta
    comprobar = g.sql_comprobar(lote)
    assert 'delete' not in comprobar.lower() and 'insert' not in comprobar.lower() and 'update' not in comprobar.lower()
    deshacer = g.sql_deshacer(lote)
    assert "delete from public.tasks where lote_carga = '%s'" % lote in deshacer and 'projects' not in deshacer.split('--')[-1]

    # Solo dos áreas: no declara ni crea la tercera
    sin_proyectos = g.sql_carga([t for t in tareas if t['area'] != 'Proyectos'], lote, None)
    assert 'c_proyectos' not in sin_proyectos

    # Validación: cada problema detiene la carga y dice el renglón
    espera_error(carpeta, [cambiar(INVENTADAS[0], 1, 'Otra')], 'renglón 4: "Área" fuera de catálogo')
    espera_error(carpeta, [cambiar(INVENTADAS[0], 4, 3)], 'renglón 4: "E+" fuera de rango')
    espera_error(carpeta, [cambiar(INVENTADAS[0], 5, None)], 'renglón 4: falta "E−"')
    espera_error(carpeta, [cambiar(INVENTADAS[0], 8, 'Urgente')], 'renglón 4: "Urgencia" fuera de catálogo')
    espera_error(carpeta, [cambiar(INVENTADAS[0], 9, 'mañana')], 'renglón 4: "Fecha límite" no es una fecha')
    espera_error(carpeta, [cambiar(INVENTADAS[0], 11, 'Parcial')], 'renglón 4: "Retomar el" no es una fecha')
    espera_error(carpeta, [cambiar(INVENTADAS[0], 16, None)], 'renglón 4: falta "Puntaje"')
    espera_error(carpeta, [INVENTADAS[0], cambiar(INVENTADAS[1], 0, 1)], 'renglón 5: ID repetido')
    espera_error(carpeta, [INVENTADAS[0], cambiar(INVENTADAS[1], 3, INVENTADAS[0][3].upper())], 'renglón 5: nombre de tarea repetido')
    espera_error(carpeta, [cambiar(INVENTADAS[0], 3, 'x' * 256)], 'pasa de 255 caracteres')
    espera_error(carpeta, [cambiar(INVENTADAS[0], 3, None)], 'tiene ID pero no tiene nombre')
    espera_error(carpeta, [], 'no tiene ninguna tarea')
    espera_error(carpeta, INVENTADAS, 'No se encontró el renglón de encabezados', encabezados=['ID', 'Area'] + g.ENCABEZADOS[2:])

    # La salida no puede ir dentro del repositorio
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assert g.principal([ruta, os.path.join(repo, 'salida')]) == 2
    assert not os.path.exists(os.path.join(repo, 'salida'))

    # Corrida completa
    salida = os.path.join(carpeta, 'salida')
    assert g.principal([ruta, salida]) == 0
    assert sorted(os.listdir(salida)) == ['1_carga.sql', '2_comprobar.sql', '3_deshacer.sql']
    return 28


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    with tempfile.TemporaryDirectory() as temporal:
        # El generador imprime su resumen; aquí no interesa.
        salida_real, sys.stdout = sys.stdout, open(os.devnull, 'w', encoding='utf-8')
        try:
            n = pruebas(temporal)
        finally:
            sys.stdout.close()
            sys.stdout = salida_real
    if len(sys.argv) > 1:
        libro(INVENTADAS).save(sys.argv[1])
        print('Excel inventado guardado en', sys.argv[1])
    print('Generador de la carga: todas las comprobaciones pasaron.')
