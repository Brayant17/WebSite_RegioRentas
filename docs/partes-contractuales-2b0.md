# Etapa 2B.0: generalización de partes contractuales

## Cierre técnico de Partes 2B.0

Estado vigente: funcionalidad normal, sin activación experimental. PUBLIC_CONTRACT_PARTIES_V2 ya no se lee; su presencia, ausencia o valor no modifica el comportamiento. La constante interna contractPartiesEnabled queda fija en true para conservar los consumidores existentes sin modificar plantillas ni el tratamiento de documentos. Se retiró la asignación de .env.development.local. El build normal ya incluye el selector y las llamadas de ocho argumentos, sin necesitar configuración adicional.

El usuario confirmó que 01 y 02 están aplicados en Supabase y las verificaciones de integridad dieron cero inconsistencias. Validación manual reportada sobre CTR-2026-000002 (BORRADOR): Renthabilidad Arrendamientos Inmobiliarios (PERSONA_MORAL) → Manuel Flores (PERSONA) → Renthabilidad (PERSONA_MORAL), guardando correctamente ambos cambios. El contrato quedó restaurado con Renthabilidad.

Este cierre modifica únicamente la activación en código, la configuración local, fixtures/pruebas y esta documentación. No ejecuta SQL remoto ni despliega. Conserva los scripts 01/02, la RPC antigua, la columna espejo, la configuración y los triggers puente. No cambia documentos históricos, snapshots, PDF, Storage ni contenido de plantillas.

Validación del cierre: node --test tests/*.test.mjs terminó con 129 pruebas aprobadas, cero fallos y una prueba opcional de Chromium real omitida. npm run build completó correctamente sin definir ningún feature flag; mantiene avisos de imports sin uso, chunk grande y runtime Node 22 de Vercel frente a Node 24 local.

Deuda técnica conservada:

- Retirar en una migración posterior la compatibilidad SQL transitoria, tras revisar consumidores y dependencias.
- Simplificar posteriormente la constante fija y las ramas internas heredadas; ya no constituyen un feature flag configurable.
- Alta de personas/empresas desde el selector: sigue pendiente; actualmente selecciona entidades existentes.
- La vista previa V1 conserva su límite de un ARRENDATARIO y como máximo un FIADOR, aunque la RPC admite varios solicitantes. La redacción legal para persona física y 2B.2 quedan fuera de este cierre.
- No se realizaron pruebas de concurrencia con varias conexiones de PostgreSQL real; sí existen pruebas locales de integridad y atomicidad.

Las secciones siguientes son el historial de implementación y revisión. Sus instrucciones antiguas sobre activar/desactivar PUBLIC_CONTRACT_PARTIES_V2 quedan sustituidas por este cierre. No volver a ejecutar migraciones ya aplicadas por esas instrucciones históricas.
## Revisión de 02 — 2026-09-30

El usuario confirma que 01 ya fue aplicado y que las siete verificaciones de integridad dieron cero inconsistencias. Confirma la huella de la RPC de seis argumentos, la secuencia public.contratos_folio_seq, el formato exacto con LPAD a seis posiciones y la regla de al menos un solicitante. Esta información sustituye las referencias históricas a una secuencia/huella pendientes en este documento. No se consultó ni ejecutó SQL contra Supabase remoto.

02 usa ahora un guard fijo sin configuración de sesión ni DDL dinámico. Conserva la RPC antigua, su configuración por defecto y sus permisos. Comprueba los triggers de 01. Se corrigieron el número de solicitantes, el folio y el mapeo literal de roles; se retiró DISTINCT para no ocultar duplicados. Cambiar arrendador conserva sus validaciones y las dos escrituras atómicas.

Equivalencia de validaciones cerrada con los bloques originales proporcionados por el usuario: fechas obligatorias y fin posterior al inicio; renta obligatoria mayor a cero; depósito obligatorio no negativo; día obligatorio entre 1 y 31. Se copiaron condiciones y mensajes exactos. Se retiraron isfinite, filtros NaN/Infinity, máximo numérico y comprobaciones de escala decimal de la nueva RPC. Las restricciones propias de los tipos y columnas permanecen intactas. La RPC antigua no se modifica.

Las pruebas SQL usan PostgreSQL local en memoria. Solo en la copia del instalador en memoria se sustituye la huella por la del fixture sintético; el archivo entregable conserva la de producción. Se comprueba además que el instalador entregable rechaza esa huella sintética. El build de esta revisión usa PUBLIC_CONTRACT_PARTIES_V2=false.
## Estado y condición previa de despliegue

Implementación local preparada con selector, edición atómica por RPC, contexto normalizado, SQL por fases y pruebas sobre PostgreSQL aislado. **No se consultó ni modificó Supabase remoto.** La funcionalidad nueva está desactivada por defecto: `PUBLIC_CONTRACT_PARTIES_V2` debe activarse únicamente después de revisar/aplicar el SQL y verificar el esquema/RPC.

**Falta contrastar la definición real de `crear_contrato_desde_solicitud`, su generador de folios y las policies vigentes.** No están versionados en el repositorio; las descripciones recibidas no incluyen el cuerpo SQL. Se solicitó esa información. El backend propuesto reproduce las reglas documentadas, pero no se presenta como una copia verificada de la RPC de producción.

El instalador `02_rpc.sql` compara la huella fija de producción y comprueba la secuencia global existente y los triggers diferidos de `01`. No necesita configuración de sesión, no crea secuencias, no calcula MAX ni ejecuta setval. La huella identifica la definición previa; las validaciones económicas y de fechas ya se contrastaron con los bloques originales proporcionados por el usuario.

## Modelo final y transición

`partes_contrato` referencia exactamente `persona_id XOR persona_moral_id`. ARRENDADOR admite ambos tipos; ARRENDATARIO, FIADOR y OBLIGADO_SOLIDARIO continúan usando persona física. Se conservan los roles históricos existentes, incluido REPRESENTANTE_LEGAL si ya hay registros; las RPC nuevas no lo insertan como parte.

La representación de una empresa continúa en `representantes_persona_moral`. Una persona puede ser representante y arrendador físico en otro contrato sin duplicar `personas`.

Se agregan FK a `personas_morales` con `ON DELETE RESTRICT`, CHECK XOR, CHECK de rol moral, índices únicos parciales por tipo de entidad, índice contrato/rol y único parcial de un ARRENDADOR por contrato. Un constraint trigger diferido exige que al finalizar la transacción cada contrato conserve exactamente uno. Se mantienen los UNIQUE anteriores para no eliminarlos por un nombre supuesto; los nuevos índices cubren el caso NULL y los antiguos pueden resultar redundantes, pero no bloquean el modelo propuesto.

`contratos.arrendador_persona_moral_id` **se conserva y deja de ser NOT NULL**. Para persona moral guarda un espejo transitorio de la parte; para persona física guarda NULL. No se usa una empresa ficticia para cumplir el esquema anterior. El trigger comprueba la coincidencia del espejo. La configuración `arrendador_persona_moral_id` tampoco se elimina ni se renombra.

Un puente diferido, únicamente al insertar un contrato, crea su parte ARRENDADOR moral si la RPC antigua solo pobló la columna. Si ya existe una parte, no crea otra. No repara silenciosamente un DELETE ni sustituye una parte contradictoria. La migración aborta ante arrendadores duplicados, conflictos entre columna/parte o contratos sin arrendador resoluble, para revisión manual sin borrar datos.

## SQL preparado

Los archivos están en `docs/sql/partes-2b0/`, fuera de un directorio de migraciones automáticas:

| Archivo | Uso |
| --- | --- |
| [00_preflight.sql](sql/partes-2b0/00_preflight.sql) | Solo lectura: definición/huella RPC, columnas, defaults, constraints, índices, políticas, grants, secuencias, roles y conteos previos. |
| [01_esquema.sql](sql/partes-2b0/01_esquema.sql) | Transacción de ampliación, backfill, validación, índices, integridad diferida y revocación de escrituras directas de partes/creación de contratos. |
| [02_rpc.sql](sql/partes-2b0/02_rpc.sql) | Instalación protegida de la sobrecarga explícita y RPC de cambio de arrendador, con helpers restringidos. Requiere revisión de la RPC real. |
| [03_lectura_admin_opcional.sql](sql/partes-2b0/03_lectura_admin_opcional.sql) | Solo si falta lectura: SELECT para administradores; no INSERT/UPDATE/DELETE. Revisar policies existentes antes de usar. |
| [04_verificacion.sql](sql/partes-2b0/04_verificacion.sql) | Solo lectura: las diez comprobaciones solicitadas, seguridad de funciones y grants. |

`01` usa una transacción y locks de tablas con timeout de 10 s; ejecutarlo en una ventana sin escrituras del módulo. Es repetible frente al esquema que crea; los nombres prefijados `partes_2b0_` deben revisarse en preflight si ya existen objetos con ese nombre. Una colisión de objetos ajenos requiere inspección, no asumir que `IF NOT EXISTS` valida su definición.

## RPC de creación

Nueva sobrecarga, sin parámetros opcionales ni ambigüedad con la anterior:

```text
crear_contrato_desde_solicitud(
  p_solicitud_id uuid, p_fecha_inicio date, p_fecha_fin date,
  p_renta numeric, p_deposito numeric, p_dia_pago integer,
  p_arrendador_tipo text, p_arrendador_id uuid
) → uuid
```

Conserva `SECURITY DEFINER`, `SET search_path = ''`, verificación de `auth.uid()` y `public.users.role = 'admin'`. Valida tipo, existencia y estatus ACTIVA para empresa. Bloquea la solicitud, exige aprobada, contrato único, una unidad y al menos un solicitante; verifica fechas, renta, depósito y día de pago. Inserta BORRADOR, el arrendador seleccionado y los participantes convertidos dentro de la misma transacción.

La conversión usa roles exactos: solicitante → ARRENDATARIO, fiador → FIADOR y «obligado solidario» → OBLIGADO_SOLIDARIO. No normaliza alias ni descarta duplicados silenciosamente; estos quedan sujetos al UNIQUE existente. No se insertan representantes legales. La selección explícita no depende de la configuración global.

El folio propuesto usa la secuencia global revisada y `CTR-YYYY-` con LPAD(numero::text, 6, '0') exacto. Se preserva la RPC de seis argumentos sin sobrescribirla; las dos deben consumir el mismo asignador global. **Confirmar que esa es la implementación real antes de ejecutar `02`; si hay reglas adicionales en la RPC vigente, trasladarlas y volver a probar.**

## Cambio de arrendador del borrador

`cambiar_arrendador_contrato_borrador(p_contrato_id, p_arrendador_tipo, p_arrendador_id)` valida sesión/admin, bloquea el contrato con `FOR UPDATE`, exige BORRADOR y una parte ARRENDADOR existente, valida la nueva entidad y actualiza ambos IDs en la misma fila. Conserva el ID de parte; sincroniza la columna transitoria dentro de la misma transacción.

No hay DELETE + INSERT desde el navegador. Si cualquiera de las escrituras falla, se revierte todo. No lee ni modifica documentos, snapshots, PDFs u objetos de Storage. Los bloqueos por contrato serializan cambios; la prueba local valida rollback e integridad, no una carga con múltiples conexiones concurrentes en producción.

## Frontend

Con la bandera activa, la creación muestra Persona moral / Persona física, búsqueda de entidades existentes y selección explícita. Las búsquedas se limitan a 40 resultados y permiten refinar texto; persona física busca nombre/apellidos/RFC y empresa busca razón social. Se distinguen coincidencias con RFC e inicio de UUID.

La configuración se consulta como propuesta inicial de empresa ACTIVA, no como restricción. Si falta o no se puede consultar, la selección manual sigue disponible. Una respuesta tardía de configuración no sobrescribe una interacción del usuario. El envío utiliza ocho parámetros y se bloquea hasta elegir una entidad válida.

El detalle muestra empresas o personas según la parte. Solo BORRADOR ofrece «Cambiar arrendador del borrador», que llama a la RPC atómica. Los botones se bloquean durante el guardado y no existe una operación de cambio sobre documentos históricos.

«+ Agregar arrendador» distingue el tipo seleccionado y explica que el alta todavía debe solicitarse al responsable de datos. **No crea entidades ni abre permisos nuevos.** Se mantiene Configuración → Arrendador con sus consultas/ediciones existentes, sin cambiar la clave de configuración.

## Contexto, variables y snapshots

En modo nuevo, la parte ARRENDADOR es la fuente de verdad. Se rechazan cero/múltiples arrendadores y referencias XOR inválidas; no se cae silenciosamente a la columna antigua.

- PERSONA_MORAL: consulta la empresa seleccionada y exactamente un representante principal, como antes.
- PERSONA: utiliza la persona embebida en la parte, sin consultar empresa, configuración ni representante; `representante = null`.

Se agregan `arrendador.tipo` y `arrendador.nombre`, manteniendo las 51 variables anteriores (53 en el catálogo). Los campos exclusivos de empresa permanecen vacíos para persona física; no se atribuye una razón social ni un representante ficticios. Las variables de representante se renderizan vacías cuando el objeto es null. Las propiedades nuevas son opcionales en el tipo para representar snapshots antiguos que no las tengan.

Preview muestra un aviso explícito para persona física: la redacción actual puede depender de una empresa y debe revisarse. No se modificó contenido jurídico ni se creó plantilla V2. No se cambió la lógica de generación histórica: clona el contexto resultante y congela HTML y snapshot. Un cambio posterior del borrador no altera ese documento. Histórico y PDF siguen leyendo únicamente el documento guardado; la maquetación 2B.1 no se tocó.

## RLS y permisos

Se inspeccionó la autenticación local: `/admin` valida sesión y rol en `users`. Esto no sustituye las comprobaciones SQL de cada RPC. No se usa Service Role en el flujo de partes.

Las policies remotas no se inspeccionaron porque se indicó no ejecutar nada contra Supabase. `00` entrega las consultas para esa revisión manual. No se presentan como verificadas.

`01` revoca INSERT/DELETE de contratos y INSERT/UPDATE/DELETE de partes para clientes; elimina también grants directos por columna y aborta si quedan permisos efectivos heredados. Mantiene las actualizaciones previas de condiciones del borrador y no cambia policies de documentos. Los helpers de validación, folio y trigger no tienen EXECUTE de cliente; solo las RPC públicas destinadas al administrador lo reciben.

`03` es opcional: habilita RLS y agrega SELECT para admins en las cinco tablas solicitadas. Configuración se limita a la clave de arrendador. No reemplaza políticas existentes: una policy permisiva previa sigue siendo permisiva, y las policies restrictivas pueden impedir lectura. Revisar también que usuarios no puedan elevar su propio `users.role`. No ampliar INSERT/UPDATE de personas, empresas o representantes para habilitar el alta pendiente.

## Orden exacto recomendado

1. **Ahora, sin activar la bandera:** revisar este informe y ejecutar manualmente solo `00_preflight.sql`, de lectura. Guardar la definición original completa y los conteos. Compartir/revisar el cuerpo SQL de la RPC, defaults, FK/UNIQUE, reglas económicas y mecanismo global del folio. No aplicar `02` mientras estos puntos sigan pendientes.
2. Probar el SQL revisado en un proyecto de prueba/restauración con el esquema real. Las pruebas PGlite usan un esquema sintético y no sustituyen esa comprobación.
3. Desplegar el código con `PUBLIC_CONTRACT_PARTIES_V2=false` o ausente. Este modo conserva las consultas y RPC de seis argumentos, sin exigir las columnas nuevas.
4. En ventana de mantenimiento del módulo, ejecutar manualmente **01_esquema.sql**. La columna previa permanece; las escrituras antiguas compatibles reciben su parte por el puente. Verificar con **04** los datos, incluido el contrato actual; comprobar también la RPC antigua contra el esquema ampliado.
5. `02_rpc.sql` contiene la huella verificada `c1e2e7ed4a9dd613bbbbe06f4dae50b7` y la secuencia `public.contratos_folio_seq`; ya no requiere `set_config`. Aborta si no coinciden la huella, la secuencia o los triggers diferidos habilitados de `01`. Su aplicación sigue siendo manual y la bandera debe permanecer false durante esta revisión.
6. Revisar permisos SELECT. Ejecutar **03** solo si hace falta y tras evaluar las policies existentes. Volver a ejecutar **04**. Confirmar en prueba: admin crea ambas variantes y cambia BORRADOR; no-admin no puede usar RPC; documentos anteriores permanecen iguales.
7. Desplegar con `PUBLIC_CONTRACT_PARTIES_V2=true` y recargar todas las sesiones administrativas antes de habilitar operaciones. Es una variable de **build** de Astro: cambiarla requiere rebuild/redeploy. Hacer el cambio en mantenimiento, no activar personas físicas mientras haya pantallas antiguas en uso. Las pantallas antiguas no comprenden un arrendador físico, aunque la RPC de seis argumentos siga disponible para crear morales.
8. Verificar una solicitud de prueba con ambas clases de persona, preview y generación de nueva revisión. Revisar visualmente la advertencia legal para persona física. Ejecutar **04**, conservar conteos y revisar igualdad de datos históricos.
9. Mantener columna, configuración, RPC antigua y puente durante la observación. Una vez existan contratos con persona física, **no volver al frontend anterior ni apagar la bandera como rollback genérico**: no puede resolverlos. Ante incidente, detener operaciones y corregir hacia adelante manteniendo el modelo nuevo; no convertirlos a empresas ficticias.
10. En una fase posterior, eliminar la rama de compatibilidad del frontend/contexto, retirar llamadas a la RPC antigua, retirar el espejo/puente y sus referencias, comprobar dependencias SQL y consumidores externos. Solo entonces preparar otra migración para retirar la columna. **Esta entrega no contiene ni autoriza ese DROP.**

## Consultas de verificación

`04` incluye: contratos sin arrendador; con más de uno; ambas entidades; ninguna entidad; moral en rol no permitido; discrepancia del espejo; duplicados; detalle de `CTR-2026-000001` (ajustar el literal si el contrato actual tiene otro folio); representante principal por empresa; conteos de contratos/partes/documentos y por rol. También muestra atributos de seguridad de funciones y grants.

Los grupos de inconsistencias deben quedar vacíos. Tras backfill, contratos/documentos no cambian de cantidad; partes aumenta exactamente en el número de contratos que necesitaban una parte ARRENDADOR. Conservar los resultados de `00` para comparar. La consulta de representante expone ausencia/multiplicidad; no la corrige ni elige arbitrariamente.

## Archivos modificados y nuevos

Rutas bajo `src/modules/admin/arrendamiento/contratos/`:

| Modificado | Cambio |
| --- | --- |
| `types.ts` | Parte con referencia a persona o empresa y detalle de empresa. |
| `repositories/contratos.repository.ts` | Consulta ampliada detrás de bandera y RPC de ocho argumentos. |
| `services/contratos.service.ts`, `hooks/useContracts.ts` | Transmiten selección y mejoran errores de despliegue. |
| `components/ContractForm.tsx` | Permite selector dentro del formulario y bloqueo por selección pendiente. |
| `CreateContractPage.tsx` | Selección explícita opcional durante transición. |
| `ContractDetailPage.tsx` | Empresas visibles y acción de cambio seguro. |
| `plantillas/types.ts` | Contexto normalizado compatible con snapshots legados. |
| `plantillas/repositories/template.repository.ts` | IDs de las partes en modo nuevo. |
| `plantillas/services/context.service.ts`, `template.service.ts` | Resuelven ambas clases de arrendador y advierten sobre redacción. |
| `plantillas/renderer.ts`, `utils/contextWarnings.ts` | Variables adicionales y representante nullable. |
| `plantillas/hooks/useContractTemplatePreview.ts`, `ContractTemplatePreviewPage.tsx` | Muestran advertencia de compatibilidad. |

Nuevos bajo ese mismo módulo: `partes/model.ts`, `partes/partes.repository.ts`, `partes/LandlordSelector.tsx` y `partes/DraftLandlordEditor.tsx`.

También nuevos: cinco archivos SQL en `docs/sql/partes-2b0/`, este informe, `tests/partes.test.mjs`, `tests/partes-selector.test.mjs`, `tests/partes-sql.test.mjs`, `tests/fixtures/partes-schema.sql`.

Otros modificados: `tests/plantillas.test.mjs` ajusta catálogo de 51 a 53 variables; `package.json` agrega `test:partes` y dependencia **solo de desarrollo** `@electric-sql/pglite@0.5.8`; `package-lock.json` registra esa dependencia. PGlite ejecuta PostgreSQL local en memoria para probar constraints, funciones y rollback sin una base remota. No se agregó una dependencia de producción.

## Verificación realizada

- **112 pruebas aprobadas**, sin omisiones: suites anteriores, 24 pruebas nuevas de partes/selector/SQL y Chromium real, incluyendo lectura del footer. Los tests de PDF histórico y sanitización siguen pasando.
- Pruebas SQL reales en PGlite: migración repetible; backfill sin duplicar personas; XOR; rol moral; unicidad; cero arrendadores rechazado; creación física/moral; tres conversiones de participantes; tipo/UUID inexistente/inactiva; no-admin/sin sesión; cambio de estado; rollback ante fallo entre escrituras; preservación de documentos; compatibilidad de sobrecarga antigua; permisos; guardia de revisión.
- Pruebas de interfaz: configuración como default, cambio de tipo y protección contra respuesta tardía que pudiera sobrescribir una selección manual. Alta preparada sin escritura.
- Contexto/snapshot: física sin consultas de representantes; moral resuelta por la parte aunque la columna vieja sea diferente; tipo/datos congelados; histórico consultado sin reconstrucción.
- TypeScript antes/después: **los mismos 15 errores preexistentes**, sin diagnósticos nuevos. No se corrigieron archivos ajenos.
- Build ejecutado con `PUBLIC_CONTRACT_PARTIES_V2=true` solo en el entorno temporal del comando, para compilar la funcionalidad nueva. No se modificó `.env` ni se desplegó. Se conserva el runtime Node 22 del adapter y los avisos previos.
- `git diff --check` sin errores de whitespace.

Comandos:

```powershell
npm run test:partes
$env:RUN_PDF_CHROMIUM='1'
# Opcional: Python con pypdf para extraer y comprobar el pie del PDF de prueba.
$env:PDF_QA_PYTHON='C:\ruta\python.exe'
node --test tests/*.test.mjs
npx tsc --noEmit --pretty false
$env:PUBLIC_CONTRACT_PARTIES_V2='true'
npm run build
git diff --check
```

## Riesgos y decisiones pendientes

La activación de producción queda supeditada a revisar la RPC/esquema/RLS reales y aplicar manualmente las fases. El SQL local no permite certificar reglas no proporcionadas. Los nombres/defaults y el mecanismo de folio del fixture de pruebas son sintéticos, no datos de producción.

También quedan pendientes el alta segura de personas/empresas desde esta pantalla, la redacción de persona física en plantilla V2/2B.2, la prueba de múltiples conexiones PostgreSQL y la retirada futura de la compatibilidad. Ninguno implica cambiar documentos existentes o el PDF 2B.1.
