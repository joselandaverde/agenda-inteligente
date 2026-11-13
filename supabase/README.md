# Esquema de la base de datos

El esquema de la app vive aquí como migraciones SQL. Una base nueva se crea
**solo** a partir de estos archivos, en este orden:

| Orden | Archivo | Qué crea |
|---|---|---|
| 1 | `migrations/20261111_esquema_base.sql` | Tablas `projects`, `tasks` y `subtasks`, con seguridad por fila |
| 2 | `migrations/20261103_ai_usage.sql` | Tabla `ai_usage` y función `ai_check_and_increment` (límite de uso de la IA) |
| 3 | `migrations/20261112_audit_log.sql` | Tabla `audit_log`: registro de acciones delicadas, que el usuario puede leer y ampliar pero no alterar |

Los archivos son independientes entre sí e idempotentes.

## Reglas

- Aplicar una migración a cualquier base es **nivel C**: requiere autorización
  expresa de José en el momento (Libro del Proyecto, §4).
- Nunca se versionan datos reales ni scripts que los contengan (`.gitignore`).
- Cada cambio de esquema es un archivo nuevo; no se edita uno ya aplicado.
- Cada migración trae al final su procedimiento de reversión.
- Antes de aplicar una migración a producción se descarga un respaldo desde la
  app ese mismo día (`docs/operacion/recuperacion.md`). Sin respaldo, no se aplica.

## Ambientes

| Ambiente | Proyecto de Supabase | Cómo quedó su esquema |
|---|---|---|
| Producción | Proyecto nuevo (bloque 0-B) | Creado solo con estas migraciones |
| Pruebas | Proyecto original | Esquema anterior a las migraciones; conserva políticas duplicadas y cinco tablas sin uso, que se revisan en el bloque 0-D |

## Pruebas de permisos

`tests/rls/pruebas_negativas.sql` comprueba, dentro de la base, que una cuenta no
alcanza los datos de otra y que el registro de acciones no se puede alterar.
Se ejecuta en la base de pruebas y no deja datos: termina con un error a
propósito que deshace todo lo que escribió.

## Después de aplicar en una base nueva

1. Authentication → Sign In / Providers → apagar "Allow new users to sign up".
2. Crear las cuentas desde Authentication → Users → Add user.
3. Comprobar que un anónimo no lee nada:
   `GET /rest/v1/tasks` con la llave pública debe responder 401 o una lista vacía.
