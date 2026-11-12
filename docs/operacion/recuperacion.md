# Respaldo y recuperación

Procedimiento del bloque 0-C (SEG-04). Describe cómo se respalda la agenda, cómo se recupera y qué queda fuera del respaldo.

## 1. Qué es el respaldo

Un archivo `agenda-respaldo-AAAA-MM-DD.json` que la app descarga desde **Categorías › Respaldo › Descargar respaldo**. Contiene:

- Todas las filas y columnas de la cuenta en las tres tablas de datos: `projects` (categorías), `tasks` (compromisos) y `subtasks` (subtareas), con sus identificadores y relaciones.
- Una ficha: formato y versión, fecha, versión de la app, base de origen, migraciones del esquema, cantidad de filas y huella (SHA-256) de cada tabla.

**El archivo no va cifrado.** Se lee como texto. Guárdalo donde solo tú tengas acceso (por ejemplo, tu iCloud) y no lo subas al repositorio ni lo pegues en conversaciones.

## 2. Qué NO contiene

| No incluye | Cómo se recupera |
|---|---|
| La cuenta y su contraseña | Se crea de nuevo en el panel de Supabase: Authentication › Users › Add user, con "Auto Confirm User" activado |
| El contador de uso de la IA (`ai_usage`) | Se regenera solo con el uso |
| La estructura de la base (tablas, reglas de seguridad) | Está en `supabase/migrations/`; se aplica en orden |
| La configuración de Supabase, Vercel y GitHub | Está descrita en `supabase/README.md` y en la evidencia del bloque 0-B |
| Las llaves (Supabase, AI Gateway) | Se generan de nuevo en cada servicio; nunca se guardan en el respaldo ni en el repositorio |

## 3. Cuándo respaldar

- **Cada semana.** La app avisa en Hoy cuando el último respaldo descargado en ese equipo tiene más de 7 días.
- **Antes de aplicar cualquier migración a la base de producción.** Regla fija: sin respaldo descargado ese mismo día, no se aplica la migración.
- Antes de cargas o borrados masivos.

El plan gratuito de Supabase no hace respaldos automáticos: si no se descarga el archivo, el respaldo no existe.

## 4. Restaurar

La restauración solo entra en una **cuenta vacía**. Nunca mezcla ni sobrescribe.

1. Entrar a la app con la cuenta vacía.
2. **Categorías › Respaldo › Restaurar desde archivo** y elegir el archivo.
3. La app revisa el archivo (formato, versión, cantidades, relaciones y huellas) y que la cuenta esté vacía. Si algo no cuadra, lo dice y no escribe nada.
4. Confirmar con **Restaurar en esta cuenta**.
5. La app escribe en orden categorías → compromisos → subtareas, conserva los identificadores, pone como dueño la cuenta que restaura y al final compara lo escrito con el archivo. Solo entonces dice "Restauración completa y comprobada".

Si falla a la mitad, la app quita lo que alcanzó a escribir y lo informa. Si dice que no pudo quitarlo todo, revisar la cuenta antes de reintentar.

Límites:

- Un respaldo entra **una sola vez por base**: los identificadores no pueden repetirse, ni siquiera en otra cuenta de la misma base.
- No sirve para deshacer un cambio puntual dentro de una cuenta con datos.

## 5. Recuperación completa desde cero

Para cuando la base se perdió o hay que reconstruir el proyecto.

1. Crear un proyecto nuevo en Supabase.
2. Aplicar, en orden, los archivos de `supabase/migrations/` en el editor de SQL del panel.
3. Configurar la autenticación como indica `supabase/README.md` (registro cerrado).
4. Crear la cuenta del usuario en el panel (ver tabla del punto 2).
5. En Vercel, apuntar las variables del ambiente a ese proyecto (`REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_BASE_DATOS`) y volver a desplegar.
6. Entrar a la app con la cuenta nueva y restaurar el último respaldo (punto 4).
7. Comprobar en Hoy y Próximos que los compromisos están, y descargar un respaldo nuevo.

## 6. Probar la restauración

La restauración se prueba en un entorno separado: un respaldo de producción se restaura en la base de pruebas, en una cuenta vacía, desde una vista previa.

Mientras producción tenga solo datos de prueba no hay restricción. Cuando tenga datos reales, la prueba se hace en una cuenta dedicada de la base de pruebas y esa cuenta se vacía al terminar.
