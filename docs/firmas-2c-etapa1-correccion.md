# 2C — Etapa 1: corrección posterior a la auditoría

Estado: SQL local **listo para revisión final**, NO ejecutado en Supabase. No hay endpoint, UI, subida de evidencias ni cambios de datos reales. `docs/firmas-2c-etapa1.md`, `sql/firmas-2c/00_*.sql`, `sql/firmas-2c/01_infraestructura.sql` y `tests/firmas-2c-infraestructura.test.mjs` se conservan sin cambios como documentos históricos.

## Archivos

| Archivo | Función |
| --- | --- |
| `sql/firmas-2c/02_infraestructura_corregida.sql` | Migración corregida. **Sustituye a 01**: aplicar solo 02, nunca ambos. Primera instalación, transaccional, no idempotente. |
| `sql/firmas-2c/03_verificaciones_adicionales_solo_lectura.sql` | Consultas de solo lectura que el diseño corregido necesita y que 00 no cubre. |
| `../tests/firmas-2c-correccion.test.mjs` | Pruebas SQL ejecutables en PGlite (PostgreSQL 18.3 en memoria). |
| `../tests/fixtures/firmas-2c-schema.sql` | Fixture sintético que extiende `partes-schema.sql` + 2B.0. |
| `../package.json` | Script `test:firmas`. |

## Resultados de Supabase (00 y 03, PDF en `../Docs`)

- PostgreSQL 17.4 con `sha256(bytea)` nativo. `estado`/`tipo`/`rol` son `text`; los CHECK de `contratos.estado` y de `documentos_contrato.tipo`/`estado` admiten todos los valores de las máquinas de estado de 2C.
- `contratos`, `partes_contrato`, `documentos_contrato` y `versiones_plantilla` pertenecen a `postgres` (RLS activa, no forzada). `postgres` y `service_role`: `rolsuper=false`, `rolbypassrls=true`. `cli_login_postgres` es miembro de `postgres`.
- FKs: `partes_contrato → contratos` CASCADE; `documentos_contrato → contratos` y `→ versiones_plantilla` RESTRICT; partes/representantes → personas/morales RESTRICT. El fixture replica las RESTRICT de documentos.
- Los privilegios predeterminados de `postgres` en `public` conceden `arwdDxtm` en tablas y EXECUTE en funciones a `anon`, `authenticated` y `service_role` (la salida está truncada: puede haber más destinatarios). Las tablas existentes conceden también TRUNCATE a esos roles.
- Datos: un contrato BORRADOR, cuatro documentos BORRADOR/GENERADO, ningún PARA_FIRMA/FIRMADO, un FIADOR (persona física por `partes_2b0_rol_moral`), sin anomalías de rutas, versiones ni representantes principales, sin funciones DEFINER con SQL dinámico.

## Ejecución manual

Ejecutar **solo** `sql/firmas-2c/02_infraestructura_corregida.sql`, completo y una sola vez, desde el SQL Editor de Supabase (rol `postgres`). Es una única transacción: cualquier excepción del preflight o de la comprobación final revierte todo y no deja objetos. Si se usa la CLI con `cli_login_postgres`, la sesión debe hacer `SET ROLE postgres` antes; si no, el preflight rechaza la instalación (no es propietario).

## Hallazgos y corrección

| Hallazgo | Corrección en 02 | Prueba |
| --- | --- | --- |
| Sintaxis: `AS $ … END $;` en `comprobar_transicion` | Comillas `$$`. | auditoría del original (42601 reproducido) |
| Sintaxis (nuevo, encontrado al ejecutar): `CASE … THEN` sin paréntesis dentro de `IF … THEN` en `proteger_firmante`; PL/pgSQL corta la condición en el primer `THEN` | `(CASE … END)` | auditoría del original («syntax error at end of input» tras corregir solo `$`) |
| Transiciones de contrato con huecos (p. ej. FIRMADO→BORRADOR, INSERT directo en cualquier estado, estado NULL, columnas no listadas editables fuera de BORRADOR) | Lista blanca de transiciones; INSERT solo en BORRADOR; fuera de BORRADOR toda la fila salvo `estado`/`updated_at` queda congelada; DELETE solo de BORRADOR sin historial; preflight rechaza estados NULL | máquina de estados |
| Transiciones de documento con huecos (tipo PARA_FIRMA/FIRMADO directo, contenido editable, ruta reescribible, estados hacia atrás) | Contenido inmutable; `storage_path` NULL→ruta canónica una sola vez; tipo BORRADOR→PARA_FIRMA solo con proceso pendiente del propio documento; estado GENERADO→{ENVIADO,REEMPLAZADO,ANULADO}, ENVIADO→{REEMPLAZADO,ANULADO}; INSERT solo BORRADOR/GENERADO; el origen queda congelado | documentos |
| Protección de partes rompe borrados en cascada | Si el contrato ya no es visible (borrado en cascada, validado antes por el trigger del contrato) la parte no se bloquea | partes; la auditoría reproduce el fallo del original |
| `LOCK TABLE … SHARE NOWAIT` (bloqueo global de catálogos, fallo inmediato ante cualquier escritor) | `FOR SHARE` de **fila** sobre las fuentes exactas, en orden por id; `lock_timeout='5s'` en la función; nueva comparación de fuentes después de bloquear. Los triggers de partes usan `FOR UPDATE` con espera acotada (el mismo modo que `partes_2b0_comprobar_arrendador`, sin escalamiento). Los de UPDATE/DELETE de documentos no bloquean el contrato (evita invertir el orden contrato→documento de la RPC) | bloqueos (`pg_locks` solo muestra `AccessShare`/`RowShare`) |
| OBLIGADO_SOLIDARIO creado por 2B.0 pero rechazado al iniciar | Se elimina la lista fija de roles. Cada versión de plantilla declara su **cobertura aprobada** (`firma_privada.cobertura_plantilla`): roles, mínimo/máximo y tipo de entidad, ligada al SHA-256 de su contenido. Un rol sin cobertura se rechaza con un mensaje explícito; con cobertura y lugar en el snapshot, firma | OBLIGADO_SOLIDARIO |
| Verificar el PDF real y reconstruir contexto **y HTML** en servidor | El recibo exige SHA-256 y tamaño del PDF calculados por el servidor, el contexto reconstruido (igualdad JSONB con `datos_snapshot`), el SHA-256 del HTML re-renderizado (comparado con el SHA-256 de `contenido_renderizado` calculado por PostgreSQL), el SHA-256 de la plantilla, la revisión de bloques del renderer y el mapa de identidades | recibo |
| Plantilla/versión identificada e inmutable | El proceso guarda `version_plantilla_id` (FK RESTRICT) y `sha256_plantilla`; un trigger impide cambiar `contenido`/`plantilla_id`/`numero_version` o borrar una versión usada en firma. Editar una versión antes del inicio invalida el recibo y la cobertura | versión de plantilla |
| Privilegios predeterminados amplios y truncados en Supabase: un destinatario no previsto conservaría permisos sobre objetos 2C | Comprobación final en la misma transacción: recorre con `aclexplode` el ACL efectivo de las tablas públicas 2C, las cuatro RPC, el esquema y todos los objetos de `firma_privada`, y aborta ante cualquier concesión fuera de la lista blanca (PUBLIC incluido) | instalación frente a privilegios predeterminados |
| Los triggers distinguen RPC de escritura directa por `current_user`=propietario; un rol cliente miembro de `postgres` podría `SET ROLE` | El preflight rechaza la instalación si `anon`, `authenticated`, `service_role` o `authenticator` son miembros del instalador. Los operadores (`cli_login_postgres`) se admiten: sin `SET ROLE` heredan los privilegios, pero los triggers los rechazan | instalación frente a pertenencia a roles |
| Identidad inequívoca de cada firmante | Máximo **uno** por rol (CHECK de cobertura): el snapshot no tiene IDs, así que un lugar por rol es la única correspondencia sin ambigüedad. PostgreSQL comprueba que el documento nombra exactamente a la entidad congelada (nombre normalizado como `templateText`/`fullName`, RFC y CURP; razón social y representante principal para la moral), que no nombra a un rol sin parte, y que el mapa parte→lugar→persona del servidor coincide con el suyo. Un firmante por parte y por lugar (`UNIQUE`) y `referencia_documento` explícita | identidad |

Otras correcciones: el recibo se ata a la versión y el proceso al recibo (FK única); la invariante diferida exige un firmante por **cada** parte (no «≥2»), el documento PARA_FIRMA/GENERADO y el recibo consumido; el preflight comprueba la propiedad de las tablas, la dependencia 2B.0 (XOR y triggers diferidos habilitados), `sha256` nativo y la ausencia de objetos previos; el control de propietario de los triggers se hace en línea (sin llamar funciones privadas desde un rol sin EXECUTE); la cancelación limita el motivo a 1000 caracteres y distingue un proceso inexistente.

## Contrato del endpoint futuro (no implementado)

`registrar_validacion_documento_firma(actor, contrato, documento, pdf_sha256, pdf_bytes, fuentes, contexto_reconstruido, html_sha256, plantilla_sha256, revision_renderer, identidades)`, solo `service_role`. Cambia la firma de la propuesta 01, que nunca se aplicó. El servidor debe:

1. Autenticar al administrador con su sesión; no aceptar `actor` del navegador.
2. Leer `firma_fuentes_para_verificar` antes y después de reconstruir; si cambian, reintentar.
3. Descargar el objeto exacto `{contrato}/{documento}/{nombre_archivo}`, comprobar `%PDF-` y el tamaño (≤10 MB), y calcular su SHA-256.
4. Reconstruir el contexto con el servicio existente desde esas fuentes y re-renderizar el HTML con la versión congelada y la revisión de bloques; calcular el SHA-256 del HTML en UTF-8.
5. Enviar el mapa `[{parte_contrato_id, rol, referencia_documento, entidad_tipo, entidad_id, persona_firmante_id, representante_origen_id}]` ordenado por `parte_contrato_id`.
6. Devolver el recibo; `iniciar_proceso_firma` se llama con el JWT del administrador, que debe ser el mismo `actor`.

PostgreSQL no puede probar que los bytes del PDF provengan del HTML: Chromium no es determinista. La garantía es que el SHA-256 del PDF queda fijado al iniciar y que la ruta del original no se puede reescribir. La inmutabilidad del objeto en Storage depende de las policies del bucket (pendiente, 00 §6).

## Compatibilidad con 2B.0

- `partes_2b0_comprobar_arrendador` y sus triggers diferidos no se modifican; la prueba compara `pg_get_functiondef` antes y después de instalar.
- `crear_contrato_desde_solicitud` (6 y 8 argumentos) inserta en BORRADOR y las partes pasan `firma_2c_parte` en la misma transacción (bloqueo propio). El puente del arrendador al COMMIT funciona.
- `cambiar_arrendador_contrato_borrador` bloquea contrato→parte, el mismo orden que 2C; fuera de BORRADOR conserva su propio rechazo.
- Ambos triggers sobre el contrato usan `FOR UPDATE`, así que no hay escalamiento de bloqueo dentro de una transacción. El borrado en cascada de un BORRADOR atraviesa ambos (`NOT FOUND → CONTINUE`).
- La edición de borradores de la app (`.eq("estado","BORRADOR")`), la inserción de documentos (`BORRADOR`/`GENERADO`) y `attachPath` (`storage_path` NULL→canónico) siguen permitidas.
- Se mantienen las firmas de `iniciar_proceso_firma(uuid,uuid,text,uuid)`, `cancelar_proceso_firma(uuid,text)` y `firma_fuentes_para_verificar(uuid)` de la propuesta.

## Pruebas

`npm run test:firmas` ejecuta el estático histórico y las nuevas pruebas. Estas instalan 2B.0 y 02 en PGlite como propietario no superusuario con BYPASSRLS, con privilegios por defecto estilo Supabase que la migración debe revocar. La suite principal corre dos veces: con `estado`/`tipo` text y con enums.

Cubren: flujo completo; arrendador moral y físico; OBLIGADO_SOLIDARIO con y sin cobertura; identidad (nombre, RFC, CURP, fiador ausente o nombrado sin parte, 0 o 2 principales, 2 arrendatarios, mapa alterado); recibo (actor, documento, hash, tamaño, caducidad, reutilización, cambios de fuentes/HTML/contexto/plantilla); permisos de anon, no admin, sin sesión y service_role, y DML directo; máquina de estados del contrato; invariante diferida frente a un proceso escrito a mano; documentos; partes y cascada; cancelación y reutilización; inmutabilidad de versión y cobertura; atomicidad ante fallo de un firmante; bloqueos; compatibilidad 2B.0; preflight; legibilidad de 03; auditoría del original; borrado de un BORRADOR con documentos (RESTRICT) y TRUNCATE con y sin CASCADE por un rol cliente (no esquiva los triggers 2C); rol cliente miembro del instalador; privilegio predeterminado no previsto; operador miembro sin `SET ROLE` y ausencia de cualquier privilegio heredado (incluidos TRUNCATE y MAINTAIN). Se verificó por mutación que retirar el `CONTINUE` de cascada, el máximo de cobertura, el control de tipo documental, la comparación de RFC, el control de pertenencia o la comprobación final de ACL hace fallar las pruebas correspondientes.

### Qué no puede simular PGlite

- **Concurrencia:** una sola conexión. No se prueban doble inicio simultáneo, esperas, `lock_timeout`, interbloqueos ni lecturas fantasma. El índice único parcial y el `FOR UPDATE` del contrato son la defensa; requiere una prueba con dos sesiones en una base desechable.
- **Supabase:** `auth.uid()` es un stub sobre `request.jwt.claim.sub`; no hay PostgREST, GoTrue, `authenticator`, Storage ni policies de bucket. `NOTIFY pgrst` no tiene receptor.
- **Esquema real:** el fixture replica tipos, FKs y roles confirmados, pero no es un volcado: columnas ajenas a 2C y policies existentes son sintéticas.
- **Roles:** PGlite corre como superusuario; el «postgres» de Supabase se simula con `propietario_sim`. Las funciones SECURITY DEFINER existentes en producción no están presentes.
- **Normalización Unicode:** `[[:space:]]` de PostgreSQL y `\s` de JavaScript pueden diferir en espacios exóticos. La divergencia produce un rechazo, nunca una aceptación.

Otras suites ejecutadas: partes (44), contratos (16), documentos (17), plantillas (43), arrendador (10) y pdf (23) pasan. `plantilla-v2-sql.test.mjs` falla («La versión origen no coincide con la V1 verificada»). Lee solo archivos de 2B.2 que no se modificaron aquí, así que el fallo es previo y ajeno a esta entrega.

## Decisiones pendientes

1. **Cobertura de plantilla.** La V2 no nombra al obligado solidario ni a un REPRESENTANTE_LEGAL como parte, e imprime siempre la línea del FIADOR (vacía si no hay). Decidir: (a) aprobar la cobertura V2 de ARRENDADOR/ARRENDATARIO/FIADOR (0..1) y que los contratos con obligado solidario sigan bloqueados hasta una versión que lo cubra; (b) redactar esa versión (requiere jurídico y el lugar `obligado_solidario` en el contexto); o (c) que 2B.0 deje de crear OBLIGADO_SOLIDARIO. Tras aprobar, el propietario ejecuta `firma_privada.registrar_cobertura_plantilla(version, sha256, roles, referencia_aprobacion)`. Sin cobertura no puede iniciarse ninguna firma.
2. **Varias personas por rol** (varios arrendatarios ya admitidos por 2B.0): hoy se rechazan porque el snapshot no tiene IDs. Habilitarlo requiere IDs en el snapshot de nuevas generaciones.
3. **Lista blanca de transiciones.** BORRADOR→{PENDIENTE_FIRMA, CANCELADO}, PENDIENTE_FIRMA→BORRADOR, FIRMADO→ACTIVO, ACTIVO→{FINALIZADO, TERMINADO_ANTICIPADAMENTE}. Confirmar con 00 §5 si existen contratos legados u otros flujos que necesiten más transiciones.
4. **Máquina documental:** confirmar las transiciones de estado propuestas y que nada en producción actualiza contenido, tipo o ruta por otra vía (00 §2, §4).
5. **Congelación completa de la fila del contrato** fuera de BORRADOR: si existen columnas de metadatos que cambian legítimamente (00 §1/§2), añadirlas a la exención.
6. **Índice único de representante principal:** la consulta dio 0 filas, pero no hay índice confirmado. Valorar `UNIQUE … WHERE es_principal` en una migración aparte.
7. **Misma persona en varios roles** del mismo contrato (p. ej. arrendatario y fiador): hoy se permite; decisión jurídica.
8. **Autoridad del propietario:** `postgres` (y cualquier función SECURITY DEFINER suya) pasa el control de propietario en procesos/firmantes. Revisar 03 §I; valorar un rol dedicado NOLOGIN como propietario 2C.
9. **Recibos caducados:** se conservan; definir retención.
10. Lo ya pendiente de la etapa 1: endpoint de verificación, registro de firmas, evidencias, finalización/activación y policies de Storage.
