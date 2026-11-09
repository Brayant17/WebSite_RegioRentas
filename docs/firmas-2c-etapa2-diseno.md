# Firmas 2C — Etapa 2: firma autógrafa con registro digital (versión final para revisión)

**Nada de esto está aplicado en Supabase.** Archivos, en orden de uso:

| Archivo | Qué es | Cuándo |
|---|---|---|
| `docs/sql/firmas-2c/05_etapa2_verificaciones_solo_lectura.sql` | Consultas de solo lectura (E1–E8 entorno/etapa 1, S1–S11 Storage) | Ya ejecutadas (resultados abajo) |
| `docs/sql/firmas-2c/06_etapa2_storage_controles_solo_lectura.sql` | Solo lectura: P1–P3 antes de instalar; C1–C6 controles periódicos de Storage | P antes de 04; C después, periódicamente |
| `docs/sql/firmas-2c/04_etapa2_firma_autografa.sql` | Esquema, triggers y RPC de la etapa 2. Solo **lee** `storage.objects` | Tras revisar P1–P2 |
| Panel de Supabase | Configuración del bucket y, si el panel lo permite, políticas restrictivas opcionales | Ver "Storage" |

El anterior `06_etapa2_storage_evidencias.sql` (políticas y trigger creados por SQL sobre `storage.objects`) se **eliminó**: no es instalable con los privilegios reales y nunca se ejecutó.

Pruebas: `tests/firmas-2c-etapa2.test.mjs` (PGlite, en `npm run test:firmas`; texto y enum).

## Resultados reales de 05 y consecuencias

| Consulta | Resultado | Consecuencia |
|---|---|---|
| E2 | Las 9 huellas coinciden con la etapa 1 del repositorio | El preflight de 04 pasa |
| E4/E5 | 1 proceso PENDIENTE, 1 CANCELADO, 6 firmantes PENDIENTE, 0 evidencias, 0 contratos inconsistentes | Pasa la condición "sin firmas, evidencias ni completados". Ambas filas cumplen los CHECK nuevos (comprobado en la prueba con un proceso pendiente y otro cancelado previos). El proceso PENDIENTE continúa con la etapa 2 |
| S3 | `storage.objects` pertenece a `supabase_storage_admin`; el instalador no es miembro, pero puede leer y escribir | 04 solo necesita SELECT (se eliminó el `FOR SHARE`, que exigía UPDATE). **No se puede** crear políticas (requiere ser propietario) ni se debe crear triggers allí |
| S5 | 0 filas | Hoy ninguna política permite escribir en `contract-documents` desde el navegador: denegación por defecto |
| S7 | `on_insert_storage_object`, `protect_objects_delete`, `update_objects_updated_at` | `on_insert_storage_object` es `BEFORE INSERT … WHEN (new.bucket_id = 'properties') EXECUTE FUNCTION set_storage_object_owner()`: no se invoca para `contract-documents`. P4–P8 confirman su cuerpo y que no haya otros triggers, reglas o funciones que interfieran |
| S8 | `eTag` string, `size` number, `mimetype` string | `objeto_pdf` compara `metadata->>'size'` (número → texto) y `mimetype`, y guarda `eTag`: compatible |
Interfaz y endpoint de subida: **no implementados** en esta entrega.

## Decisiones aprobadas y cómo quedan

| # | Decisión | Implementación |
|---|---|---|
| 1 | Cancelar sigue prohibido con firmas; anulación aparte | `cancelar_proceso_firma` sin cambios (huella verificada). Nueva `anular_proceso_firma` (ver abajo) |
| 2 | PDF escaneado con declaración expresa | `registrar_evidencia_firma` exige `p_confirma_correspondencia = true` y `p_declaracion_version = 'PDF_FIRMADO_CORRESPONDE_V1'`; guarda `declaracion_version` y el **texto exacto** aceptado (`declaracion_texto`, incluye el SHA-256 del PDF origen) |
| 3 | Máximo 5 evidencias inmutables; completar elige una | Límite en RPC y trigger (las reservas vigentes cuentan). UPDATE/DELETE rechazados siempre. `completar_proceso_firma(p_proceso, p_evidencia, p_sha256_evidencia)` |
| 4 | Solo el tipo de identificación | `verificacion_identidad ∈ {INE, PASAPORTE, CEDULA_PROFESIONAL, OTRA}`; no hay columnas para número ni copia (probado) |
| 5 | Fecha declarada ≠ fecha de registro | `firmado_at` = fecha **declarada**, ahora **obligatoria** (`p_firmado_at` sin valor por defecto), acotada a `[iniciado_at, ahora]`; `registrado_at` = reloj del servidor. CHECK `firmado_at ≤ registrado_at`. Comentarios en columnas |
| 6 | Documento original intacto | El documento `PARA_FIRMA/GENERADO` no se toca en ningún camino (completar, anular). El PDF firmado vive en `evidencias_firma` |
| 7 | Storage protegido y huérfanos | Denegación por defecto + configuración del panel + detección (04) y controles C1–C6 (06, solo lectura); reservas con caducidad (sección "Storage") |

## Flujo

1. Proceso `PENDIENTE` (etapa 1), contrato `PENDIENTE_FIRMA`.
2. Por cada firmante, el administrador coteja la identificación en persona y registra la firma con la fecha declarada: `registrar_firma_firmante`.
3. El servidor (endpoint futuro) autentica al admin, pide una reserva (`reservar_evidencia_firma` → id, ruta, vencimiento a 15 min), valida y hashea el PDF, lo sube a esa ruta con `upsert=false` y lo registra con la declaración: `registrar_evidencia_firma`.
4. El administrador completa eligiendo una evidencia: `completar_proceso_firma`. Proceso → `COMPLETADO`, contrato → `FIRMADO`.
5. Si no puede completarse y ya hay firmas o evidencias: `anular_proceso_firma`.

## RPC

| RPC | EXECUTE | Valida | Escribe |
|---|---|---|---|
| `registrar_firma_firmante(p_proceso, p_firmante, p_sha256_documento_origen, p_verificacion_identidad, p_firmado_at)` | `authenticated` + `admin_actual()` | proceso/contrato pendientes; hash = origen del proceso; firmante del proceso y `PENDIENTE`; tipo de identificación; fecha declarada obligatoria en `[iniciado_at, ahora]` | firmante → `FIRMADO` con `firmado_at` (declarada), `registrado_por`, `registrado_at` (servidor), `verificacion_identidad` |
| `reservar_evidencia_firma(p_actor, p_proceso)` → `(evidencia_id, ruta_storage, vence_at)` | solo `service_role` | `p_actor` admin; proceso/contrato pendientes; evidencias + reservas vigentes < 5 | fila en `firma_privada.reservas_evidencia` (ruta canónica `<contrato>/firmas/<proceso>/<evidencia>/firmado.pdf`, vence en 15 min) |
| `registrar_evidencia_firma(p_actor, p_proceso, p_evidencia, p_sha256, p_size_bytes, p_mime_type, p_declaracion_version, p_confirma_correspondencia)` | solo `service_role` | admin; SHA hex 64; 1 B–10 MiB; `application/pdf`; confirmación = true y versión vigente; proceso/contrato pendientes; reserva del mismo proceso y admin, vigente y sin usar; no es un PDF origen; hash no reutilizado; objeto en el bucket con ese tamaño/tipo, creado después de la reserva (fila bloqueada `FOR SHARE`) | evidencia con declaración, `storage_object_id` y `storage_etag`; reserva → consumida. Reintento idéntico = idempotente |
| `completar_proceso_firma(p_proceso, p_evidencia, p_sha256_evidencia)` | `authenticated` + admin | todas las firmas; cobertura y plantilla congeladas; evidencia del proceso con ese hash, registrada **después del registro** de la última firma; objeto en Storage con el mismo id y eTag (no sustituido) | proceso → `COMPLETADO` (+ `completado_por`, evidencia, hash firmado); contrato → `FIRMADO` |
| `anular_proceso_firma(p_proceso, p_motivo, p_destino_contrato)` | `authenticated` + admin | motivo 10–1000 caracteres (se guarda sin espacios exteriores); destino `BORRADOR` o `CANCELADO`; proceso/contrato pendientes; al menos una firma o evidencia (si no, se indica usar cancelar) | proceso → `ANULADO` (+ `anulado_at`, `anulado_por`, `motivo_anulacion`, `destino_contrato_anulacion`); contrato → destino |
| `listar_reservas_evidencia_vencidas(p_limite)` | solo `service_role` | — | nada (lectura) |
| `marcar_reserva_evidencia_limpiada(p_reserva)` | solo `service_role` | reserva sin evidencia, vencida hace > 1 h, objeto ya no presente | reserva → `limpiada_at` (idempotente) |

`iniciar_proceso_firma` y `cancelar_proceso_firma` no cambian (el preflight verifica su huella md5).

## Anulación administrativa

### Transiciones

Proceso (`procesos_firma.estado`):

```
PENDIENTE ──cancelar (sin firmas ni evidencias)──▶ CANCELADO      (etapa 1, sin cambios)
PENDIENTE ──completar (todas las firmas + evidencia)──▶ COMPLETADO
PENDIENTE ──anular (≥1 firma o ≥1 evidencia, motivo, destino)──▶ ANULADO   (nuevo)
COMPLETADO / CANCELADO / ANULADO: inmutables
```

Contrato (solo los cambios de 2C):

| Desde | Hacia | Única vía |
|---|---|---|
| `PENDIENTE_FIRMA` | `BORRADOR` | cancelar, o anular con destino `BORRADOR` |
| `PENDIENTE_FIRMA` | `CANCELADO` | **nueva**: solo anular con destino `CANCELADO` |
| `PENDIENTE_FIRMA` | `FIRMADO` | completar |

### El contrato después de anular: no hay valor por defecto

El administrador elige el destino de forma expresa y queda registrado en el proceso:

- **`BORRADOR`**: el acuerdo sigue, pero hay que corregir algo (otro fiador, un error en el documento) o repetir la firma. El contrato vuelve a ser editable y puede iniciar **un proceso nuevo, solo sobre una revisión nueva** del documento. El PDF con firmas parciales no puede volver a circular: `comprobar_documento` (etapa 1) ya rechaza un `PARA_FIRMA` cuyo proceso no esté `CANCELADO`, y el trigger de la etapa 2 rechaza además el mismo SHA-256. Como Chromium incrusta la fecha de creación, una regeneración produce otro hash.
- **`CANCELADO`**: la operación no seguirá. Es un estado terminal, igual que `BORRADOR → CANCELADO` hoy.

Tanto la anulación como el cambio de estado del contrato ocurren en la misma transacción. Ni el propietario puede llevar el contrato a un destino distinto del registrado. Tampoco puede dejar un proceso anulado con el contrato en `PENDIENTE_FIRMA`: lo detecta la comprobación diferida al COMMIT (probado).

### Qué se conserva y qué se bloquea

- Se conservan intactos, sin ninguna escritura: firmantes (también las firmas ya registradas), evidencias, reservas, documento origen y objetos de Storage (la anulación no toca Storage; C3/C4 vigilan los objetos). Las pruebas comparan fila por fila antes y después.
- Quedan bloqueados: nuevas firmas, reservas, registro de evidencias (también de reservas abiertas), completar, cancelar y una segunda anulación. El proceso anulado es inmutable incluso para el propietario.
- Un proceso con **todas** las firmas pero sin completar también se puede anular. Es la única salida si, por ejemplo, la cobertura de la plantilla cambió y `completar` ya no es posible.

## Cambios de esquema

- `procesos_firma`: `completado_por`, `evidencia_firmada_id`, `sha256_documento_firmado` (FK compuesta a la evidencia del mismo proceso y hash), `anulado_at`, `anulado_por`, `motivo_anulacion`, `destino_contrato_anulacion`. Los dos CHECK de estado de la etapa 1 (nombres generados por PostgreSQL) se **sustituyen** por `procesos_firma_2c2_estado` y `procesos_firma_2c2_cierre`. Conservan las reglas previas y añaden `ANULADO`. El preflight exige encontrar exactamente esos dos (consulta E4). Índice único de un `COMPLETADO` por contrato.
- `firmantes_proceso`: `registrado_at`, `verificacion_identidad`; CHECK de coherencia con el estado.
- `evidencias_firma`: `declaracion_version`, `declaracion_texto`, `storage_object_id`, `storage_etag`. `UNIQUE(sha256)` y FK `id → reservas_evidencia(id)`. Toda evidencia nace de una reserva.
- `firma_privada.reservas_evidencia` (nueva, sin acceso para clientes).
- Auxiliares privadas: `ruta_evidencia`, `declaracion_evidencia`, `objeto_pdf` (lectura de `storage.objects`), `proteger_reserva`.
- No cambian ni RLS de tablas públicas, ni la plantilla, ni la cobertura, ni `documentos_contrato`.
- **Nada en el esquema `storage`**: ni políticas, ni triggers, ni bloqueos, ni escrituras (lo comprueba una prueba sobre el texto de 04 y sobre el resultado instalado).

## Triggers (lista blanca ampliada)

Se mantiene el criterio de la etapa 1. Solo el propietario (las RPC `SECURITY DEFINER`) escribe, y una escritura directa de `authenticated`/`service_role` falla.

| Trigger | Añade solo |
|---|---|
| `proteger_proceso` | `PENDIENTE → COMPLETADO` (firmas + evidencia del proceso); `PENDIENTE → ANULADO` (exige firmas o evidencias y `anulado_por` admin); cancelar con firmas/evidencias se rechaza también aquí. Rechaza un proceso nuevo sobre el documento o el hash de uno anulado |
| `proteger_firmante` | un único UPDATE `PENDIENTE → FIRMADO` en proceso pendiente |
| `proteger_evidencia` | solo INSERT con reserva vigente del mismo admin y proceso, ruta canónica, declaración igual al texto canónico, máximo 5 |
| `proteger_reserva` (nuevo) | INSERT en ruta canónica; después solo `consumida_at` o `limpiada_at`, una vez; sin DELETE |
| `proteger_contrato` | `PENDIENTE_FIRMA → FIRMADO` (último proceso completado) y `PENDIENTE_FIRMA → CANCELADO` (último proceso anulado con ese destino) |
| `comprobar_transicion` (al COMMIT) | completado ⇒ contrato firmado + firmas + evidencia; `FIRMADO` con historial ⇒ completado; cancelado ⇒ sin firmas/evidencias; **anulado ⇒ con firmas o evidencias** |

## Permisos

- Ninguna tabla gana privilegios. `anon` no tiene ninguno. `authenticated`/`service_role` conservan solo `SELECT` (RLS de admin) sobre las tres tablas públicas. Nadie fuera del propietario accede a `firma_privada.*`.
- EXECUTE: `authenticated` → firmar, completar, anular (con `admin_actual()` dentro); `service_role` → reservar, registrar evidencia, listar/marcar reservas (con `p_actor` comprobado como admin). Nada para `anon`/`PUBLIC`.
- Todas las funciones `SECURITY DEFINER` nuevas tienen `search_path=''` y no usan SQL dinámico (probado). El único `EXECUTE format(...)` es del instalador (bloque `DO`, para borrar los CHECK por nombre).
- El postflight de 04 vuelve a comprobar el ACL efectivo de todo 2C y aborta ante cualquier concesión fuera de la lista blanca.

## Concurrencia y transacciones

- **Orden de bloqueo único:** contrato `FOR UPDATE` → proceso `FOR UPDATE` → firmantes (`ORDER BY id`) → reserva → evidencia. `storage.objects` solo se lee, sin bloqueo: ninguna RPC espera por Storage ni Storage por ellas. Es el mismo de iniciar/cancelar y lo siguen las 6 RPC con escritura. Todas las operaciones de firma de un contrato quedan serializadas por el bloqueo del contrato, sin ciclos posibles; `lock_timeout = 5s`. Lo verifica una prueba estática.
- Cada RPC es una sola sentencia y una sola transacción. Probado inyectando un fallo en el último paso de completar y de anular (ambos destinos): no cambia nada.
- **Carreras** (quien llega segundo espera el bloqueo y ve el estado del primero):
  - completar ↔ anular: el segundo falla con "no pendiente";
  - firmar o registrar evidencia ↔ anular: igual;
  - doble anulación: igual, y queda el primer `anulado_por`;
  - doble completado: además, índice único parcial;
  - misma evidencia en dos contratos (sin bloqueo común): `UNIQUE(sha256)`.
- **Storage frente a la transacción:** Storage queda fuera de la transacción. Si el objeto desaparece o cambia antes de registrar, el registro falla. Si cambia entre el registro y el completado, `completar` lo rechaza (id + eTag). Si cambia después de completar, lo detecta C3. Ya no se bloquea la fila: sin un trigger que proteja el objeto, el bloqueo solo retrasaba un borrado unos milisegundos y exigía UPDATE sobre una tabla de Supabase.

## Instalación con los privilegios reales

**04 es instalable de forma independiente.** No depende de 06 ni del panel, y del esquema `storage` solo necesita SELECT, que S3 confirma.

1. Ejecutar **P1–P3** de `06_etapa2_storage_controles_solo_lectura.sql`. Después, **P4–P9**: definición y análisis de `set_storage_object_owner()`, todos los triggers de storage, reglas, event triggers, funciones propias que toquen Storage y tareas de pg_cron. Si algo difiere de lo esperado en cada consulta, hay que conciliar antes de instalar.
2. Instalar `04` en el SQL Editor con el mismo rol que la etapa 1, sin cambiar privilegios. Todo ocurre en una transacción: si falla el preflight, el postflight o cualquier paso, no queda nada.
   - Bloqueos de la instalación: ACCESS EXCLUSIVE breve sobre `procesos_firma`, `firmantes_proceso` y `evidencias_firma` (columnas, CHECK, FK y triggers nuevos). No bloquea `contratos` ni `storage.objects`. Con `lock_timeout = 10s`, si hay actividad aborta limpio; conviene un momento sin uso.
   - El proceso PENDIENTE actual sigue vivo y continúa con las reglas de la etapa 2. El CANCELADO cumple los CHECK nuevos.
3. Panel: confirmar la configuración de la sección "Configuración en el panel".
4. Ejecutar **C1–C6** justo después de instalar y luego de forma periódica. Esperado: C1, C3 y C4 sin filas.

## Storage

### Quién puede escribir en el bucket y qué lo controla

| Vía | ¿Le aplican las políticas RLS? | Protección |
|---|---|---|
| Navegador (API de Storage con el JWT del usuario: `anon`/`authenticated`) | Sí. La API ejecuta sus consultas con el rol del JWT | Denegación por defecto: hoy ninguna política de escritura alcanza el bucket (S5 = 0). Opcional: restrictivas del panel |
| Servidor con `service_role` (API de Storage o REST) | **No** (`BYPASSRLS`) | Disciplina de código (abajo) + detección: id/eTag en `completar` y C3 |
| Panel de Supabase (miembros de la organización) | No | Roles de la organización + C3 |
| URL firmadas de **subida** (`createSignedUploadUrl`) | No: autoriza el token | No se emiten. Regla: nunca para `contract-documents` |
| SQL directo (`postgres`, SQL Editor) | No (BYPASSRLS) | `protect_objects_delete` bloquea DELETE directo (por su nombre; confirmar en P1) y un DELETE por SQL tampoco borraría el archivo físico. UPDATE sigue siendo posible con la escritura que muestra S3: C3 lo detecta |

Reglas para el servidor (endpoint futuro y código actual):

- Subidas siempre con `upsert: false`. `privateStorage.ts` ya lo hace.
- Nunca usar `update`, `move` ni `remove` sobre `contract-documents`, salvo en la tarea de limpieza.
- La tarea de limpieza borra solo las rutas exactas que devuelve `listar_reservas_evidencia_vencidas`: nunca por prefijo ni por carpeta.
- No emitir URL firmadas de subida.

### Qué fue del 06 anterior

| Parte | Decisión | Motivo |
|---|---|---|
| 3 políticas RESTRICTIVE por SQL | **Eliminadas del SQL**; opcionales en el panel | `CREATE POLICY` exige ser propietario de `storage.objects` (o miembro de su rol) |
| Trigger `firma_2c_objeto_storage` | **Eliminado**, sin sustituto en el esquema storage | Aunque el rol tuviera el privilegio TRIGGER, sería modificar una tabla gestionada por Supabase sin ser su propietario. Puede chocar con sus migraciones y sus propios triggers (`protect_objects_delete`), y bloquear operaciones internas |
| `FOR SHARE` en `objeto_pdf` (04) | **Eliminado** | Sin el trigger, el bloqueo no protegía nada tras el COMMIT, y exigía UPDATE sobre `storage.objects` |
| Detección por id + eTag (04) | Se mantiene | Funciona con solo SELECT |
| Vigilancia | **Nueva**: C1–C6 | Detecta lo que ninguna política puede impedir |

### Membresía en `supabase_storage_admin`: no la recomiendo

- **Riesgo:** ese rol es propietario de todo el esquema `storage`. El instalador, y cualquiera con sus credenciales (SQL Editor, CLI, conexión directa), podría alterar o eliminar tablas de Storage, deshabilitar su RLS o quitar los triggers de Supabase **en todos los buckets**. Es un aumento de privilegio sobre todo el almacenamiento para proteger un solo bucket.
- **Mantenimiento:** Supabase migra Storage con ese rol. Los objetos propios en su esquema son un punto de rotura en cada actualización.
- **Viabilidad:** conceder un rol exige `ADMIN OPTION` sobre él, y `supabase_storage_admin` es un rol reservado de la plataforma. Lo previsible es que no se pueda conceder, o que se haga fuera de lo soportado.
- **Necesidad:** baja. Frente al navegador basta con la denegación por defecto; las restrictivas solo protegen de un error de configuración futuro, que C1 detecta. Frente a `service_role`, solo un trigger impediría la sustitución, y ese riesgo se cubre con control de acceso y detección.

### Configuración en el panel

1. **Storage → Buckets → `contract-documents`:** pública desactivada, 10 MB, MIME `application/pdf`. Comprobar con C2.
2. **Storage → Policies:** **ninguna política** para `contract-documents`, ni siquiera de lectura: el navegador solo usa URL firmadas creadas por el servidor. Cualquier política de otro bucket debe llevar un filtro **positivo** (`bucket_id = 'otro'`), nunca ir sin filtro ni usar `<>` o `NOT IN`. Revisar C1 tras cada cambio.
3. **Opcional, solo si el editor de políticas del panel permite elegir comportamiento *restrictive* sobre `storage.objects` y lo ejecuta con derechos de propietario.** No he podido comprobar que lo permita. Si la opción no aparece o falla con "must be owner", no crear nada en su lugar: una política permisiva no puede denegar, solo ampliar, y empeoraría la situación.

```sql
-- Políticas restrictivas opcionales (panel)
CREATE POLICY contract_documents_sin_alta_cliente ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
 WITH CHECK (bucket_id IS DISTINCT FROM 'contract-documents');
CREATE POLICY contract_documents_sin_cambio_cliente ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
 USING (bucket_id IS DISTINCT FROM 'contract-documents') WITH CHECK (bucket_id IS DISTINCT FROM 'contract-documents');
CREATE POLICY contract_documents_sin_baja_cliente ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
 USING (bucket_id IS DISTINCT FROM 'contract-documents');
```

   Efectos, probados con una política amplia `FOR ALL USING(true)` presente:
   - el navegador no puede subir, hacer upsert, actualizar, mover ni borrar en `contract-documents`;
   - otros buckets funcionan igual y la lectura no cambia;
   - `service_role` no se ve afectado;
   - el instalador no puede crearlas (`must be owner`).
4. **Organización:** limitar quién tiene acceso al panel con permisos de escritura sobre Storage. Para consulta, usar un rol de solo lectura si el plan lo ofrece.

### Comportamiento por operación de la API de Storage

| Operación | Qué hace en la base | Hoy (sin políticas) | Con restrictivas + política amplia | `service_role` |
|---|---|---|---|---|
| `upload` (`upsert: false`) | INSERT | Denegado | Denegado | Permitido; si la ruta existe, 409 (no sobrescribe) |
| `upload` (`upsert: true`) / `update` | INSERT … ON CONFLICT / UPDATE | Denegado | Denegado | **Sustituye** → `completar` lo rechaza; C3 lo detecta |
| `move` | UPDATE de `name` | No ve la fila: nada | Nada | **Mueve** → C3: AUSENTE |
| `copy` hacia el bucket | INSERT | Denegado | Denegado | Permitido (ruta nueva; no toca evidencias) |
| `remove` | DELETE | No ve la fila: la API no da error y no borra | Igual | **Borra** → C3: AUSENTE |
| Descarga con URL firmada | Token, sin RLS | Solo lectura | Solo lectura | — |

Las pruebas reproducen el SQL que genera cada operación, no la API real. Que la API de Storage ejecute sus consultas con el rol del JWT es el comportamiento documentado de Supabase, pero no está verificado en este proyecto. Para verificarlo hay que intentar una subida con una sesión de navegador. Es una escritura que debería fallar, así que conviene hacerla en un proyecto de prueba y no en producción.

### Reservas y huérfanos sin el trigger

El diseño **sigue siendo seguro** y no dependía del trigger:

- Para registrar hace falta una reserva **vigente**. Se comprueba bajo el bloqueo del contrato, con el reloj de la base, en la RPC y en el trigger de `evidencias_firma` (tabla nuestra).
- La limpieza solo recibe reservas **no consumidas, sin evidencia y vencidas hace más de 1 hora**. Una reserva vencida ya no puede consumirse nunca, así que el objeto de una ruta listada no puede llegar a ser evidencia: no hay carrera entre listar y borrar.
- La ruta de una evidencia es la de una reserva **consumida**, y esas nunca se listan.
- `marcar_reserva_evidencia_limpiada` exige que el objeto ya no exista, lo que prueba que el borrado ocurrió. El borrado se hace con la API de Storage (`remove([ruta])` con `service_role`), no con SQL: `protect_objects_delete` lo impediría y además quedaría el archivo físico.
- Una subida muy tardía, posterior a la limpieza, vuelve a aparecer en el listado.
- C5 clasifica los objetos de `/firmas/`: EVIDENCIA, RESERVA_VIGENTE, HUERFANO_LIMPIABLE y SIN_RESERVA. Los SIN_RESERVA se revisan a mano y nunca se borran en automático.

Lo que el trigger añadía y ya no existe es impedir que un error del servidor o una persona con la clave de servicio o acceso al panel borre una evidencia. Queda como riesgo residual (abajo).

### Riesgos residuales

| Riesgo | ¿Se impide? | Mitigación |
|---|---|---|
| `service_role`/panel sustituye o borra una evidencia **antes** de completar | No, pero `completar` lo rechaza | Volver a subir la evidencia (máx. 5) |
| Lo mismo **después** de completar | No | C3 lo detecta. El SHA-256 guardado permite validar cualquier copia. Clave de servicio solo en el servidor; roles de organización; C3 periódico. Opcional (decisión aparte): copia externa con retención inmutable |
| Política permisiva amplia añadida en el futuro | Solo si existen las restrictivas del panel | C1 tras cada cambio de políticas; regla del filtro positivo |
| `on_insert_storage_object` (limitado a `properties`) cambia en el futuro | — | P4–P6 tras cualquier cambio en Storage; un trigger sin `WHEN` de otro bucket aparece con `excluye_contract_documents=false` |
| URL firmadas de subida | — | No emitirlas para este bucket |
| PDF origen sustituido | No | C4 comprueba presencia, tamaño y tipo. Su SHA-256 está en el proceso (etapa 1) para verificar el contenido descargado |
| Supabase retira el SELECT de `postgres` sobre `storage.objects` | — | Registrar y completar fallarían con error, sin escribir nada (fallo seguro); C3–C5 también fallarían: visible, no silencioso |

## Comprobaciones

- Antes de instalar: P1–P3 de `06_etapa2_storage_controles_solo_lectura.sql`. Lo de `05` ya está ejecutado.
- Después: C1–C6, que no escriben nada (una prueba lo verifica). Cada consulta indica su resultado esperado.

## Limitaciones de las pruebas en PGlite

- Una sola conexión: la concurrencia real (esperas de bloqueo, `lock_timeout`, carreras de `UNIQUE`) no se ejecuta. Se comprueban el orden de bloqueo de forma estática y las carreras en ambos órdenes de forma secuencial.
- `storage.*` es una réplica con los **privilegios reales**: propietario distinto (como `supabase_storage_admin`), instalador no miembro y con solo SELECT, RLS activo, privilegios amplios para los roles cliente y ninguna política. No incluye la API de Storage, `protect_objects_delete` ni el cálculo real de `metadata`. `on_insert_storage_object` se reproduce con su definición real y un cuerpo supuesto (`owner_id := auth.uid()`) para probar P4–P6.
- `auth.uid()` se simula con `request.jwt.claim.sub`; los roles replican lo verificado en la etapa 1.
- La caducidad de reservas se prueba desplazando sus fechas con `session_replication_role=replica`. No se espera en tiempo real.
- Las huellas md5 del preflight se calcularon sobre el `02` del repositorio, normalizando CRLF. E2 confirmó que coinciden con lo instalado.

## Pendiente para la siguiente entrega (no incluido)

- Endpoint de subida (reserva → validación del PDF → subida con `upsert: false` → registro) y tarea de limpieza de huérfanos (`remove([ruta])` solo sobre rutas listadas).
- Ejecución programada de C3–C6 (o una RPC equivalente de solo lectura para un job) y alertas.
- Interfaz: registrar firma con fecha declarada, subir evidencia mostrando el texto de la declaración, completar, anular. `SignatureProcessStatus` (`firmas/types.ts`) aún no incluye `ANULADO`.

## Garantías jurídicas (resumen)

El registro digital documenta quién verificó, cuándo se declaró la firma y cuándo se registró, sobre qué PDF exacto y con qué declaración del administrador. La validez de la firma depende de la firma autógrafa y de la verificación presencial. No es firma electrónica avanzada ni constancia NOM-151.
