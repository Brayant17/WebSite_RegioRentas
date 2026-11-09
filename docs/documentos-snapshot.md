# Generación de documentos y snapshot histórico

## Flujo implementado

1. El administrador abre la vista previa del contrato BORRADOR y selecciona una versión de plantilla.
2. La preview muestra los campos importantes vacíos como advertencias y bloquea “Generar documento” si hay variables desconocidas.
3. “Generar documento” abre una confirmación. Se captura el ID exacto de la versión mostrada; no se vuelve a elegir una versión.
4. Al confirmar se recargan los datos actuales y esa versión específica, reutilizando el servicio de preview, el constructor de contexto y el renderer.
5. Se valida que no haya variables desconocidas y que el HTML no esté vacío. Se obtiene la revisión siguiente del documento por contrato.
6. Un solo INSERT guarda el contexto utilizado y el HTML producido por ese contexto. El resultado muestra la revisión creada y un enlace para abrirla.
7. El detalle del contrato lista documentos por `numero_version DESC`. La ruta histórica lee únicamente el registro de `documentos_contrato`, valida su pertenencia al contrato, sanitiza el HTML almacenado y lo muestra en el iframe aislado existente.

Ruta histórica: `/admin/arrendamiento/contratos/[id]/documentos/[documentoId]`.

## Archivos creados

Rutas relativas a la raíz del repositorio:

| Archivo | Función |
| --- | --- |
| `src/modules/admin/arrendamiento/contratos/plantillas/utils/contextWarnings.ts` | Detección compartida de los nueve campos importantes vacíos. |
| `src/modules/admin/arrendamiento/contratos/documentos/types.ts` | Tipos de documento histórico, resumen e inserción. |
| `src/modules/admin/arrendamiento/contratos/documentos/repositories/documentos.repository.ts` | Siguiente revisión, INSERT, listado y lectura por documento/contrato. |
| `src/modules/admin/arrendamiento/contratos/documentos/services/documentos.service.ts` | Validación y generación, nombre seguro, errores útiles y consulta histórica. |
| `src/modules/admin/arrendamiento/contratos/documentos/hooks/useDocumentGeneration.ts` | Mutación con bloqueo síncrono de doble envío y estados de guardado/error/éxito. |
| `src/modules/admin/arrendamiento/contratos/documentos/hooks/useContractDocuments.ts` | Carga/reintento del listado e histórico; sanitización reutilizada al visualizar. |
| `src/modules/admin/arrendamiento/contratos/documentos/components/DocumentShared.ts` | Enlaces y presentación de fecha de generación. |
| `src/modules/admin/arrendamiento/contratos/documentos/components/ContractDocuments.tsx` | Sección “Documentos del contrato”. |
| `src/modules/admin/arrendamiento/contratos/documentos/components/GenerateDocumentButton.tsx` | Confirmación explícita, generación y acceso al resultado. |
| `src/modules/admin/arrendamiento/contratos/documentos/HistoricalDocumentPage.tsx` | Visualización inmutable del contenido guardado. |
| `src/pages/admin/arrendamiento/contratos/[id]/documentos/[documentoId].astro` | Ruta administrativa Astro. |
| `tests/documentos.test.mjs` | Catorce pruebas de generación, persistencia, histórico y hooks reales de React. |
| `docs/documentos-snapshot.md` | Este informe. |

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `src/modules/admin/arrendamiento/contratos/plantillas/services/template.service.ts` | Devuelve también el mismo contexto que produjo el HTML y las advertencias de campos vacíos. |
| `src/modules/admin/arrendamiento/contratos/plantillas/hooks/useContractTemplatePreview.ts` | Conserva ID de versión renderizada y advertencias. |
| `src/modules/admin/arrendamiento/contratos/plantillas/ContractTemplatePreviewPage.tsx` | Advertencias y acción de generación. |
| `src/modules/admin/arrendamiento/contratos/ContractDetailPage.tsx` | Integra el listado de documentos. |
| `package.json` | Agrega `test:documentos`; no incorpora dependencias nuevas. |

Los archivos locales de las etapas anteriores se conservan. No se ejecutaron cambios de esquema, RPC, policies ni escrituras contra datos reales.

## Datos persistidos

```ts
{
  contrato_id: contractId,
  version_plantilla_id: selectedVersionId,
  numero_version: maxDocumentRevisionForContract + 1,
  tipo: "BORRADOR",
  estado: "GENERADO",
  nombre_archivo: `${safeFolio}-v${numero_version}.pdf`,
  storage_path: null,
  datos_snapshot: structuredClone(contextUsedByRenderer),
  contenido_renderizado: renderedHtml,
  generated_at: "now"
}
```

`id`, `created_at` y `updated_at` quedan a cargo de los valores por defecto de la tabla existente. El campo `generated_at` recibe el literal de entrada `now`, que PostgreSQL convierte a la fecha/hora de inicio de la transacción al interpretar `timestamptz`. No es una cadena histórica literal ni se utiliza como fecha contractual. Véase [valores especiales de fecha/hora de PostgreSQL](https://www.postgresql.org/docs/18/datatype-datetime.html#DATATYPE-DATETIME-SPECIAL-TABLE).

El nombre reserva una futura denominación PDF; no existe archivo PDF ni se ofrece descarga. El folio se normaliza a letras ASCII, números, guion y guion bajo, se limita a 100 caracteres y usa `contrato` si no queda ningún carácter utilizable. La revisión valida el rango positivo de integer.

`datos_snapshot` mantiene exactamente el `ContractTemplateContext` serializable de V1: `contrato`, `arrendador` con `representante`, `arrendatario`, `fiador`, `inmueble` y `unidad`. Guarda valores de presentación originales, no escapados. `contenido_renderizado` guarda el HTML exacto del renderer, que sí escapó esos valores. No se guarda el envoltorio del iframe ni el resultado modificado por DOMPurify.

Ambos salen de una sola carga/renderización; no se reconstruye el contexto para realizar el INSERT. El ID almacenado es el de la versión seleccionada. `numero_version` es la revisión independiente del documento, no el número de esa versión de plantilla.

## Consultas y comportamiento histórico

- Generación reutiliza las consultas de la preview para el contexto actual y la versión elegida.
- Siguiente revisión: SELECT `numero_version` de `documentos_contrato`, WHERE `contrato_id = id`, ORDER BY `numero_version DESC`, LIMIT 1. Incluye todos los tipos/estados anteriores.
- Persistencia: INSERT explícito en `documentos_contrato`, seguido de SELECT de metadatos para confirmar el resultado.
- Listado: SELECT de metadatos WHERE `contrato_id = id`, ORDER BY `numero_version DESC`. No descarga todos los snapshots/HTML.
- Histórico: SELECT de metadatos, `datos_snapshot` y `contenido_renderizado` WHERE `id = documentoId AND contrato_id = id de URL`. El servicio comprueba adicionalmente `documento.contrato_id === id`.
- Visualización: HTML almacenado → sanitización existente → iframe con `sandbox=""` y CSP. No llama al constructor de contexto ni al renderer, ni consulta tablas de contrato/plantilla/personas/unidad para recomponer contenido.
- Un registro anterior sin HTML genera un mensaje de contenido histórico no disponible; no se intenta reconstruirlo.

La navegación al detalle vuelve a cargar el listado. También hay actualización manual y recarga al restaurarse una página desde la caché de navegación del navegador.

## Validaciones y advertencias

Se mantienen las validaciones del constructor V1, la existencia de contrato y versión, y el requisito BORRADOR. Las versiones de plantilla siguen restringidas a BORRADOR, conforme al selector existente.

Bloquean la generación: error de carga/cardinalidad/formato, versión inaccesible o inexistente, discrepancia de ID, variables desconocidas y contenido HTML vacío o de espacios después de renderizar.

Estos campos vacíos generan advertencias, sin bloquear:

- `contrato.fecha_firma`
- `contrato.lugar_firma`
- `arrendador.razon_social`
- `arrendador.representante.nombre_completo`
- `arrendatario.nombre_completo`
- `inmueble.direccion_completa`
- `contrato.renta`
- `contrato.fecha_inicio`
- `contrato.fecha_fin`

Se muestran antes de confirmar usando la preview, y después del éxito usando los datos realmente generados. No se cambia el comportamiento del renderer: una variable conocida vacía sigue siendo conocida.

## RLS y privilegios necesarios (documentación; no aplicada)

El frontend necesita **SELECT e INSERT**, mediante el rol PostgreSQL `authenticated`, sobre `public.documentos_contrato`. La cuenta debe tener `public.users.id = auth.uid()` y `role = 'admin'`. SELECT debe permitir leer todas las revisiones del contrato para calcular correctamente el máximo y ver documentos generados. INSERT necesita también SELECT porque se solicita la fila insertada.

Predicados necesarios para las policies, a revisar/configurar por el responsable de la base de datos:

**SELECT — `TO authenticated`, `USING`:**

```sql
exists (
  select 1 from public.users u
  where u.id = (select auth.uid()) and u.role = 'admin'
)
```

**INSERT — `TO authenticated`, `WITH CHECK`:**

```sql
exists (
  select 1 from public.users u
  where u.id = (select auth.uid()) and u.role = 'admin'
)
and tipo = 'BORRADOR'
and estado = 'GENERADO'
and storage_path is null
and numero_version >= 1
and datos_snapshot is not null
and jsonb_typeof(datos_snapshot) = 'object'
and contenido_renderizado is not null
and length(btrim(contenido_renderizado)) > 0
and generated_at is not null
and exists (
  select 1 from public.contratos c
  where c.id = documentos_contrato.contrato_id and c.estado = 'BORRADOR'
)
and exists (
  select 1 from public.versiones_plantilla v
  where v.id = documentos_contrato.version_plantilla_id and v.estado = 'BORRADOR'
)
```

La infraestructura debe mantener RLS habilitada y los grants SELECT/INSERT para `authenticated`; estas expresiones no conceden privilegios de tabla por sí solas. No se requieren ni se implementan UPDATE/DELETE para esta tarea. Las policies existentes de `users`, `contratos`, `versiones_plantilla` y las tablas del contexto deben permitir las lecturas administrativas correspondientes. Los predicados de INSERT incluyen controles de estado del lado de la base de datos para cubrir cambios entre validación e inserción.

Esto es una especificación de acceso, no una migración ejecutada ni una modificación automática de policies. La distinción `USING` para SELECT y `WITH CHECK` para INSERT está descrita en la [documentación RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

Los errores de permisos se reportan explícitamente con los permisos requeridos. RLS que filtra SELECT silenciosamente puede devolver una lista vacía; el cliente no puede distinguir esa situación de la ausencia de filas. Por ello, los permisos deben comprobarse en el entorno real.

## Concurrencia, inmutabilidad y límites

- Se mantiene `UNIQUE (contrato_id, numero_version)`. La consulta del máximo y el INSERT son operaciones separadas. Una colisión `23505` informa que otra generación ocupó esa revisión; no reintenta automáticamente ni elimina la constraint. Un endurecimiento futuro podría asignar la revisión en una transacción del servidor.
- El hook bloquea sincrónicamente un segundo envío, además de deshabilitar el botón. Cada intento manual nuevo requiere confirmación.
- Si se pierde la respuesta de red después de insertar, se informa que el resultado no está confirmado y se pide consultar el listado antes de volver a generar. No se implementa idempotencia entre sesiones en esta etapa.
- El contexto y la plantilla se recargan al confirmar; pueden diferir de una preview antigua. Se conserva el ID elegido, no se escoge otra versión. Las lecturas del contexto no constituyen una transacción entre tablas.
- El registro guarda snapshot y HTML en un mismo INSERT. La UI no ofrece edición ni sobrescritura. La inmutabilidad absoluta frente a otros clientes o administradores de BD depende de la configuración de permisos existente.
- Se conserva el ID de la versión de plantilla, el contexto utilizado y el HTML producido; no se agrega una copia del HTML fuente de la plantilla, hashes ni otros campos ajenos al esquema.
- El criterio de HTML vacío es cadena vacía/de espacios. Un HTML con etiquetas sin texto no se interpreta semánticamente como vacío en el servicio puro.
- Fechas de generación se muestran en `America/Mexico_City`; las fechas DATE contractuales mantienen el formateador sin timezone de V1.
- No se han probado las policies remotas ni se ha realizado una generación con sesión real. Todas las pruebas de persistencia sustituyen Supabase.

## Verificación

- `npm run test:documentos`: 14 pruebas nuevas aprobadas.
- La prueba fundamental genera v1 con renta `$12,000.00`, simula después un contexto con `$13,000.00`, y verifica tanto el servicio histórico como el hook de visualización real de React: v1 mantiene `$12,000.00`. Durante su consulta solo se permite `documentos_contrato`; reconstruir contexto fallaría la prueba.
- La prueba de doble envío monta el hook real en React/jsdom, deja pendiente el INSERT, intenta generar dos veces y comprueba un único INSERT y el botón deshabilitado.
- También cubre revisiones, nombres seguros, snapshot sin escaping adicional, versión elegida, advertencias, bloqueo por variables desconocidas/HTML vacío/estado, orden del listado, pertenencia de URL, documentos legados, colisiones y permisos.
- Suites existentes: 43 pruebas aprobadas; sumadas a las 14 nuevas, **57 pruebas aprobadas**.
- TypeScript: mismos 15 errores preexistentes, sin diferencias en los diagnósticos anterior/posterior. No se modificaron los módulos ajenos que los producen.
- `npm run build`: correcto, Astro y empaquetado Vercel finalizados con código 0. Persisten los avisos existentes sobre imports sin uso, tamaño del chunk del dashboard y Node local 24 frente al runtime Vercel 22.
- `git diff --check`: correcto.

No se generan archivos PDF/DOCX, no se usa Storage y no se cambia el estado del contrato ni de la plantilla.
