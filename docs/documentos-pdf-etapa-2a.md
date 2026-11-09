# Documentos de contratos: etapa 2A

## Resultado y arquitectura

Se incorporan Generar PDF, Ver PDF y Descargar PDF al listado y a la vista histórica. React llama a un cliente HTTP; los endpoints Astro delegan en autorización, servicio de documentos, generador Chromium y repositorios separados.

- `POST /api/admin/arrendamiento/contratos/{contratoId}/documentos/{documentoId}/pdf`: genera o recupera el archivo definitivo. Devuelve `storagePath`, `alreadyExists`, `reconciled`.
- `POST /api/admin/arrendamiento/contratos/{contratoId}/documentos/{documentoId}/pdf-url`: cuerpo JSON `{"mode":"view"}` o `{"mode":"download"}`. Devuelve `url` y `expiresIn: 300`. Cada clic obtiene una URL nueva; descarga incluye el nombre reservado en Content-Disposition mediante Storage.

El generador recibe exclusivamente `documentos_contrato.contenido_renderizado`. No consulta contrato, personas, unidad ni plantilla, ni llama al constructor de contexto o renderer. No modifica snapshot, HTML, revisiones, fechas, nombres o estados. La única escritura SQL del flujo es `storage_path`, condicionada a que todavía sea NULL y a ambos IDs.

## Autenticación y errores

Ambos endpoints aceptan solo POST, validan origen cuando está presente y rechazan `Sec-Fetch-Site: cross-site`. Reutilizan las cookies de `supabaseServer` y `auth.getUser()`; consultan `public.users` por el ID verificado y exigen `role = 'admin'`. Los roles enviados por el navegador o guardados en user_metadata no autorizan nada. Solo después se construye el cliente Service Role.

UUIDs se validan antes de consultar documentos; el documento debe pertenecer al contrato indicado. No basta con que la página sea administrativa. Respuestas JSON `Cache-Control: no-store` y `nosniff`; logs con ID de petición, acción, IDs y código de error, sin HTML, credenciales o URL firmada.

| Estado | Significado |
| --- | --- |
| 200 | Generado, ya existente o acceso temporal creado |
| 400 / 405 | IDs, cuerpo o método inválidos |
| 401 / 403 | Sin sesión / sin rol admin u origen rechazado |
| 404 | Documento inexistente o ajeno al contrato |
| 409 | Ruta inconsistente, objeto faltante, ocupado o vínculo en conflicto |
| 422 | HTML vacío/inválido/excesivo o nombre de archivo inseguro |
| 500 | Configuración, Chromium, Storage o persistencia fallidos |

Un PDF ya existente responde 200 de forma idempotente, sin regenerarlo. Un `storage_path` guardado cuyo objeto falta requiere intervención: no se recrea automáticamente.

## Chromium y sanitización

Dependencias de producción exactas: `playwright-core@1.63.0`, `@sparticuz/chromium@153.0.0`, `jsdom@30.1.1`. jsdom ya era dependencia de desarrollo y ahora también se necesita en el servidor; `@types/jsdom` es de desarrollo. DOMPurify existente se reutiliza. No se agregan Puppeteer ni el paquete completo Playwright.

DOMPurify utiliza una única lista de etiquetas/atributos compartida con preview e histórico. En servidor se ejecuta con una ventana jsdom sin ejecución de scripts ni carga de recursos; se cierra al terminar. El cuerpo sanitizado debe contener texto. Se preservan tablas y estilos inline existentes, pero no scripts, handlers, links activos, frames, objetos, SVG o imágenes.

El wrapper temporal tiene CSP `default-src 'none'`, permite solo estilos inline y no se guarda en BD. Chromium desactiva JavaScript y service workers; intercepta y aborta todas las solicitudes de recursos. Por ello también se bloquean URLs en CSS inline. No se cargan fuentes, imágenes ni hojas CSS remotas. Preview usa DOMPurify en navegador y su iframe/CSP; PDF añade jsdom, validación de texto y aislamiento de red Chromium.

Carta, márgenes CSS 20 mm verticales y 18 mm horizontales, Arial/Helvetica/sans-serif 11 pt, interlineado 1.45, fondos habilitados, sin márgenes adicionales. La fuente disponible de sustitución puede variar entre Windows y Linux. No hay logos ni paginación avanzada.

## Runtime y desarrollo local

Probado en Windows con Node 24.16.0. Por los requisitos de jsdom, usar Node **22.22.2 o superior dentro de 22.x**, o **24.15.0 o superior dentro de 24.x**. El adapter existente genera funciones Vercel `nodejs22.x`.

```sh
npm ci
npx playwright-core install chromium --no-shell
npm run dev
```

El resolver utiliza el ejecutable de la caché de Playwright; no supone una instalación de Chrome en una ruta fija. Como alternativa, configurar `PDF_CHROMIUM_EXECUTABLE_PATH` con la ruta absoluta de un Chromium compatible, mediante el entorno o `.env` local. Es opcional y no lleva prefijo PUBLIC_. Un ejecutable personalizado incompatible puede fallar.

En Vercel (`VERCEL=1`), se resuelve el binario Linux incluido en `@sparticuz/chromium` y se extrae en `/tmp`. No se descarga durante una petición. `astro.config.mjs` incluye explícitamente los cuatro archivos `.br` del paquete y mantiene estas dependencias externas al bundle SSR para que el adapter las trace. `maxDuration: 60`.

El build verificado incluye `chromium.br`, `al2023.tar.br`, `fonts.tar.br` y `swiftshader.tar.br`, con función de aproximadamente 133.4 MB sin comprimir (tamaño total medido localmente; cambia al modificar dependencias). El adapter emite un aviso por Node local 24 y elige Node 22. Configurar Node 22 en el proyecto Vercel y comprobar que su versión patch satisface jsdom. No se cambió el proveedor de despliegue.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | URL del proyecto existente |
| `PUBLIC_SUPABASE_ANON_KEY` | Autenticación SSR mediante cookies, ya existente |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor**, lectura de documentos, escritura condicional y Storage |
| `PDF_CHROMIUM_EXECUTABLE_PATH` | Opcional, ejecutable local compatible |
| `VERCEL` | La plataforma proporciona `1`; no activarla en Windows local |

Configurar Service Role en `.env` local y en las variables protegidas del entorno Vercel correspondiente; volver a desplegar tras configurarlas. Nunca usar `PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, enviar esa clave a React o registrarla. La inspección del bundle cliente no encontró referencias a Service Role, Playwright ni infraestructura PDF del servidor.

## Configuración manual exacta de Supabase

No se ejecutó SQL remoto ni se cambiaron policies. En Dashboard → Storage crear el bucket **contract-documents** con **Public desactivado**, MIME permitido `application/pdf` y límite 10 MB. Alternativamente, ejecutar manualmente una vez:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-documents', 'contract-documents', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'contract-documents';
```

Si ya existe, comprobar y corregir manualmente que sea privado en Dashboard; el SQL no cambia un bucket existente. Cada operación del servidor comprueba esta propiedad y falla explícitamente si no existe o es público. No se crea desde un request.

Revisar que `public.users` tenga el ID de Auth del administrador con `role = 'admin'`, y que su sesión pueda consultar su propia fila con las políticas existentes. Mantener RLS en `documentos_contrato` y sus permisos previos SELECT/INSERT; **no agregar UPDATE al frontend** para esta etapa. La Service Role se usa exclusivamente tras la autorización server-side y permite la operación sin añadir policies de cliente.

No se necesita ninguna policy SELECT/INSERT/UPDATE/DELETE de cliente sobre `storage.objects` para este bucket. Revisar políticas ya existentes, especialmente las generales sin filtro `bucket_id`, para asegurar que no concedan acceso directo a `contract-documents`. El carácter privado impide acceso público anónimo por URL pública, pero no revoca una policy que otorgue acceso explícito. No se requiere otorgar permisos al navegador; únicamente recibe URLs firmadas de 300 segundos. Quien posea una URL puede usarla hasta que expire.

## Ruta, inmutabilidad y recuperación

Ruta única: `{contrato_id}/{documento_id}/{nombre_archivo}`, por ejemplo `uuid-contrato/uuid-documento/CTR-2026-000001-v1.pdf`. Solo se almacena esa ruta relativa, nunca una URL. El nombre reservado admite caracteres ASCII alfanuméricos, guion y guion bajo más extensión `.pdf`; no permite rutas, escapes o traversal.

1. Si hay ruta guardada, comprobar el archivo y devolver existencia, sin generar.
2. Si no hay ruta, comprobar primero si ya existe el objeto determinista válido por MIME/tamaño.
3. Si falta, generar y subir con `contentType: application/pdf`, `upsert: false`.
4. En carrera de upload, aceptar el objeto ya creado después de comprobarlo, sin sobrescribirlo.
5. Actualizar exclusivamente `storage_path WHERE storage_path IS NULL`. Si otro request ya vinculó la misma ruta, considerar éxito.

Si el upload funciona y el UPDATE falla, devolver `PDF_PENDING_LINK` y conservar el archivo. La UI permite reintentar Generar PDF. El siguiente intento detecta el objeto y únicamente reconcilia su vínculo. También cubre caídas del proceso después del upload. No hay borrado automático ni job de reconciliación; se recupera al reintentar. Si la ruta es diferente o los metadatos del objeto son inválidos, se detiene para revisión administrativa.

Dos requests pueden calcular bytes simultáneamente antes de que se guarde el primer archivo. El primer upload exitoso define el único objeto histórico; nunca se reemplaza con el segundo. No se garantiza igualdad byte a byte entre ejecuciones Chromium (metadatos internos pueden variar). No hay bloqueo distribuido que evite el coste duplicado de renderizado. El hook bloquea doble clic inmediatamente mediante ref, además de deshabilitar los botones.

## Pruebas y validación

```sh
npm run test:pdf
node --test tests/*.test.mjs
npx tsc --noEmit --pretty false
npm run build
git diff --check
```

Integración opcional con navegador previamente instalado, en PowerShell:

```powershell
$env:RUN_PDF_CHROMIUM='1'
npm run test:pdf:chromium
```

Resultado: 23 pruebas PDF + 57 anteriores = **80 aprobadas**. Adicionalmente pasó la integración Chromium real: PDF Carta 612×792 puntos, varias páginas y cero requests hacia un servidor HTTP de prueba pese a CSS/HTML malicioso. La suite de integración se omite por defecto cuando no se activa la variable. No requiere Supabase ni datos reales.

Cobertura: HTML congelado sin reconstrucción; pertenencia; HTML inválido; idempotencia; rutas/traversal; 401/403 para generación y acceso; MIME/upsert; actualización exclusiva y condicional; bucket privado; URLs firmadas y descarga; doble clic; fallo Chromium/Storage; recuperación tras fallo SQL; concurrencia; CSP/sanitización; método/origen y errores sin secretos.

TypeScript conserva exactamente los 15 errores preexistentes en UnitCardOld, DropDownActions, BrokerTab, DocumentsStep, GuarantorStep, SummaryStep, rentalStore y useProperties. No se modificaron. Build completado; avisos existentes por chunks grandes y selección de runtime del adapter. `git diff --check` sin errores de whitespace.

## Límites y comprobación posterior al despliegue

- HTML máximo 1 MB; PDF máximo 10 MiB. Launch de Chromium: 20 s; página: 15 s; cierre del navegador tras 30 s de ejecución. Límite global Vercel: 60 s. Cold starts, extracción y operaciones de red consumen ese presupuesto.
- No se ha ejecutado Chromium Linux en una función Vercel real ni probado Storage/RLS contra el proyecto remoto. El empaquetado local sí incluye binario y dependencias. La memoria y duración disponibles dependen del plan; verificar generación en Preview antes de producción.
- Tras crear el bucket/configurar variables, probar con admin una revisión de prueba: generar, abrir, descargar, repetir, recargar; confirmar objeto único y solo cambio de `storage_path`. Con sesión anónima/no admin, confirmar 401/403 en ambos endpoints.
- Sin firma, DOCX, regeneración, cambios de estado ni reconstrucción histórica. Para cambiar contenido se necesita una nueva revisión. Sin rate limit global/distribuido; una sesión admin puede generar distintos documentos en paralelo.
- La prueba Chromium valida estructura y aislamiento; no sustituye la revisión visual del contrato real y sus saltos de página. Fuentes locales pueden producir pequeñas diferencias de maquetación.

## Archivos de esta etapa

Nuevos, bajo `src/modules/admin/arrendamiento/contratos/`:

- `plantillas/sanitizeRules.ts`.
- `documentos/server/{auth,dependencies,documentRepository,errors,paths,pdfService,request,types}.ts`.
- `documentos/server/pdf/{chromium,generator,printHtml}.ts`.
- `documentos/server/storage/privateStorage.ts`.
- `documentos/services/pdf.client.ts`, `documentos/hooks/useDocumentPdf.ts`, `documentos/components/PdfActions.tsx`.

También nuevos: los endpoints `src/pages/api/admin/arrendamiento/contratos/[contratoId]/documentos/[documentoId]/{pdf,pdf-url}.ts`, `tests/pdf.test.mjs`, `tests/pdf.chromium.test.mjs` y este informe.

Modificados: `astro.config.mjs`, `package.json`, `package-lock.json`, `plantillas/sanitize.ts`, `documentos/components/ContractDocuments.tsx` y `documentos/HistoricalDocumentPage.tsx`. Se preservaron los cambios previos de las etapas anteriores que ya estaban en el workspace.

Referencias técnicas: [Chromium para serverless](https://github.com/Sparticuz/chromium), [instalación de navegadores Playwright](https://playwright.dev/docs/browsers), [API de lanzamiento](https://playwright.dev/docs/api/class-browsertype).
