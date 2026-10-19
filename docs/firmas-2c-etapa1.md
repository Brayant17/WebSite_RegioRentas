# 2C — Etapa 1: infraestructura propuesta para revisión externa

Estado: SQL local, NO ejecutado, NO aprobado para producción hasta resolver las verificaciones. No UI, subida, PDFs ni cambios de datos reales. El código operativo de 2B.0/2B.2 queda intacto.

## Archivos

- `sql/firmas-2c/01_infraestructura.sql`: migración transaccional de primera instalación, no idempotente. Repetirla aborta por nombres existentes; no borra ni sustituye infraestructura previa.
- `sql/firmas-2c/00_verificaciones_solo_lectura.sql`: consultas para ejecutar manualmente por el responsable. No ejecutadas por Codex.
- `../tests/firmas-2c-infraestructura.test.mjs`: comprobaciones estáticas; no ejecutan SQL.

## Tablas, índices y auditoría

Tres tablas públicas: procesos_firma, firmantes_proceso y evidencias_firma. UUIDs, FKs RESTRICT y checks explícitos. Un índice parcial permite un solo proceso PENDIENTE por contrato. Firmantes únicos por proceso/parte/persona: una persona puede tener dos obligaciones en partes distintas. SHA-256 requiere 64 caracteres hexadecimales minúsculos. Hay índices para historial, documento, parte y evidencias por proceso.

Proceso conserva contrato, documento, método MANUAL, estado, hash, ruta original, fila documental y fuentes congeladas, iniciador y tiempos; cancelación conserva autor/motivo/fecha. Firmantes guardan entidad contractual, rol, nombre, persona material, carácter y snapshots de parte/persona/representación. Evidencias tienen rutas independientes únicas y metadatos de archivo. No hay operación de completar/firmar/cargar evidencias en esta etapa: los triggers rechazan esas escrituras.

Se agrega UN recibo técnico privado `firma_privada.validaciones`, no una cuarta entidad contractual pública. Necesario porque el cliente no es una autoridad para declarar el hash real del objeto ni la equivalencia del contexto. Caduca en cinco minutos y se consume una sola vez. Contiene actor, hash, fuentes y documento exactos. No almacena bytes del PDF.

## RPCs y contrato de confianza (integración posterior obligatoria)

- `firma_fuentes_para_verificar(contrato)`: solo service_role, lee una estructura ordenada del contrato, partes, personas, moral, representantes principales, unidad y edificio.
- `registrar_validacion_documento_firma(actor,contrato,documento,sha256,fuentes,contexto_actual)`: solo service_role. Verifica administrador, pertenencia y fuentes; exige igualdad JSONB completa entre contexto reconstruido y snapshot documental. Devuelve recibo privado.
- `iniciar_proceso_firma(contrato,documento,sha256,validacion)`: solo authenticated, auth.uid + admin. Bloquea contrato/documento/recibo, exige BORRADOR y documento GENERADO con PDF/HTML/snapshot y ruta canónica; consume recibo correcto/no caducado. Congela partes y representante, marca documento PARA_FIRMA y contrato PENDIENTE_FIRMA en la misma transacción.
- `cancelar_proceso_firma(proceso,motivo)`: solo authenticated, auth.uid + admin. Bloquea contrato/proceso, exige pendiente y motivo, cancela y devuelve contrato a BORRADOR. No permite cancelar por esta vía si ya hubiera firmas o evidencias.

Ninguna RPC selecciona el último documento. El ID siempre es explícito.

**PostgreSQL no verifica los bytes remotos por recibir un hash ni por leer storage.objects.** El futuro endpoint de preparación debe:

1. autenticar al administrador con sesión real (no aceptar actor arbitrario del navegador);
2. leer fuentes consistentes antes/después de reconstruir contexto con el servicio existente; si cambiaron, rechazar/reintentar;
3. descargar el objeto exacto en contract-documents, comprobar PDF, tamaño y calcular SHA-256 del lado servidor;
4. reconstruir contexto desde esas fuentes, no usar el contexto entregado por el cliente; exigir igualdad con datos_snapshot;
5. verificar que el documento/PDF corresponde a las identidades y obligaciones que se proponen firmar;
6. emitir recibo mediante service_role y devolver su ID al administrador; iniciar con JWT del administrador (auth.uid), nunca con service_role sin identidad;
7. mantener objetos inmutables por policies/operaciones autorizadas entre verificación e inicio.

Este endpoint NO se implementa ahora. Sin recibo, inicio falla explícitamente. El hash de la RPC se coteja con el recibido de este verificador confiable; no se presenta como verificación autónoma de bytes desde PostgreSQL. No debe exponerse registrar_validacion al navegador ni otorgarse EXECUTE a authenticated.

El snapshot histórico no trae todos los IDs de identidades. Comparación completa acredita igualdad de los datos representados, pero no prueba por sí sola una identidad histórica si dos personas tienen los mismos datos visibles. Antes de conectar el verificador debe definirse confirmación administrativa explícita de identidades o un snapshot con IDs en nuevas generaciones. Casos ambiguos se rechazan; nunca se presupone equivalencia de personas solo por nombre. Esto es un requisito pendiente, no una garantía implementada en la BD.

## Firmantes y representantes

PERSONA: la persona de la parte firma por derecho propio. PERSONA_MORAL: la parte continúa siendo la sociedad; su representante principal se congela como persona material y con su carácter, sin crear otro ARRENDADOR. Cambios de catálogos posteriores no reconstruyen ni actualizan snapshots.

Todos los firmantes creados son requeridos. Etapa 1 admite ARRENDADOR, ARRENDATARIO y FIADOR. Si hay OBLIGADO_SOLIDARIO o una parte REPRESENTANTE_LEGAL independiente, aborta el inicio: su cobertura en plantilla/obligación necesita aprobación; no se omiten partes ni se inventa redacción. El modelo soporta esos roles para una ampliación aprobada.

## Inmutabilidad y cancelación

Triggers bloquean cambios de condiciones y partes fuera de BORRADOR, protegen originales referenciados incluso tras cancelar, impiden nuevas revisiones fuera de BORRADOR y bloquean borrar procesos/firmantes/evidencias. Nuevos estados FIRMADO/ACTIVO no pueden saltarse desde BORRADOR. Las operaciones finales se habilitarán en otra etapa, no mediante UPDATE directo.

El documento permanece PARA_FIRMA/GENERADO tras cancelar: cancelar un proceso no demuestra que el contenido sea inválido ni que se haya enviado; ANULADO/ENVIADO no se asignan sin esa acción. Se conserva su foto anterior en proceso.documento_snapshot. Se permite reutilizarlo en un nuevo proceso solamente con un nuevo recibo y comprobación completa de consistencia. Si el contrato cambió, la validación falla.

Las tablas nuevas no conceden DML a anon/authenticated/service_role; solo SELECT administrativo y RPCs limitadas. Funciones auxiliares privadas sin EXECUTE público. Triggers de tablas existentes comprueban invariantes también en escrituras service_role. El dueño de la base/superusuario sigue teniendo capacidad de mantenimiento/desactivar triggers: no se promete inmutabilidad frente a ese actor.

El inicio utiliza bloqueos SHARE breves sobre fuentes y FOR UPDATE sobre contrato/documento/recibo. Esta estrategia conservadora puede bloquear escrituras globales de catálogos; debe probarse contención/deadlocks con RPCs existentes antes de producción. Cualquier deadlock debe abortar la transacción, nunca continuar parcialmente.

## Storage futuro

Original: `{contrato_id}/{documento_id}/{nombre_archivo}`.
Firmado: `{contrato_id}/firmas/{proceso_id}/{evidencia_id}/firmado.pdf`.
No se cambia documentos_contrato.storage_path. Evidencias corregidas tendrán otro ID/ruta. El trigger de evidencias bloquea todas las escrituras por ahora. La siguiente etapa deberá comprobar pertenencia del prefijo de contrato, validar bytes y coordinar Storage/BD con reintentos; no son una sola transacción.

## VERIFICACIONES REQUERIDAS EN SUPABASE

Ejecutar manualmente las siete secciones de `00_verificaciones_solo_lectura.sql` y revisar:

1. Columnas/tipos/defaults reales: IDs UUID, relaciones unidad/edificio, fechas y snapshot JSONB. FKs deben tener claves únicas compatibles. El preflight solo verifica presencia de columnas, no todo el DDL.
2. CHECK/enums de contratos/documentos deben permitir las transiciones; revisar constraints e índices existentes, incluidos cardinalidad de representante, documento/revisión y partes.
3. Triggers actuales y su orden/funciones: timestamps, bloqueo de condiciones, cambio de estado, 2B.0 y cambios documentales. Confirmar que no impiden PARA_FIRMA ni la cancelación atómica y que no causan mutaciones de contenido.
4. RLS WITH CHECK/USING, grants de tabla y columna y permisos users. Revisar todas las RPC SECURITY DEFINER que podrían escribir directamente en estas tablas. Validar propietarios, search_path, roles heredados y privilegios de CREATE en schemas.
5. Roles/estados reales presentes y procesos previos externos. La migración aborta si ya hay PENDIENTE_FIRMA sin infraestructura 2C. Revisar actores/personas/partes históricos antes de añadir RESTRICT para nuevos procesos.
6. Bucket privado, MIME/tamaño y policies de Storage: impedir overwrite/delete del original a clientes autenticados; service_role debe mantenerse solo en endpoints autorizados y sin funciones de reemplazo. DB no puede garantizar inmutabilidad de objetos por sí sola.
7. Nombres de tablas/schema/funciones nuevos libres; permisos del rol de migración; no ejecutar dos veces ni usar reemplazos automáticos de objetos existentes.

Tras revisar resultados, probar la migración en una base desechable compatible: inicio/cancelación válidos; anon/no admin; documento ajeno/sin PDF; hash/fuentes/snapshot desactualizados; representantes ambiguos; rollback si falla cualquier firmante; doble inicio concurrente; reutilización de recibo; modificación vía authenticated/service_role; preservación de filas/objetos históricos. **No se ejecutó esta matriz SQL por instrucción del usuario.**

## Decisiones pendientes antes de activar

- Aprobar el recibo técnico privado y el contrato de verificación servidor; implementar/verificar ese endpoint en una etapa posterior.
- Resolver identificación histórica inequívoca cuando snapshots no contienen IDs.
- Aprobar cobertura de OBLIGADO_SOLIDARIO y REPRESENTANTE_LEGAL como partes independientes.
- Revisar impacto de locks/triggers y políticas reales.
- Etapas posteriores: registro individual, evidencias, completar firma y activación, cancelación con evidencia, auditoría de esos eventos y eventual proveedor electrónico. Métodos/estados se ampliarán con migraciones explícitas; no se habilitan capacidades electrónicas ficticias.
