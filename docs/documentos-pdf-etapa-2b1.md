# Etapa 2B.1: presentación del PDF

## Alcance y resultado

Se mejora exclusivamente la presentación al generar un PDF nuevo. El cuerpo contractual sigue siendo `documentos_contrato.contenido_renderizado`, leído del documento histórico y sanitizado. No hay nuevas escrituras, cambios de autenticación, Storage, estados o reglas de negocio. Los PDFs existentes siguen saliendo por la rama idempotente de 2A; tampoco se reemplaza un objeto pendiente de reconciliar.

La única ampliación de lectura es `datos_snapshot` en la misma consulta a `documentos_contrato`, para obtener el folio del pie. No se consulta el contrato actual. No se guarda el wrapper ni sus clases/CSS en la base de datos.

## Maquetación

- Carta (612 × 792 puntos), márgenes superior/laterales de 20 mm e inferior de 22 mm. CSS `@page` y opciones Playwright comparten las medidas; la revisión del PDF confirma que no se suman dos juegos de márgenes.
- Arial/Helvetica/sans-serif, 11 pt e interlineado 1.45; texto negro, pie gris discreto y sin recursos remotos.
- Título principal centrado de 15 pt; secciones de 12 pt; títulos de cláusula de 11 pt en negrita. Espaciados contenidos y consistentes.
- Párrafos justificados, separación inferior de 6 pt, `hyphens: auto`, tres líneas huérfanas/viudas. El comportamiento de separación silábica depende del Chromium y las fuentes disponibles.
- Incisos textuales `a)`, `b)`, etc. con sangría francesa de 18 pt. Listas HTML conservan sus elementos y numeración. Líneas de inventario compuestas por guiones bajos conservan todo su texto, con espaciado propio.

## Títulos, cláusulas y saltos

Encabezados semánticos y títulos reconocidos usan `break-after: avoid` y su equivalente `page-break-after`, además de evitar división del propio encabezado. El párrafo siguiente conserva sus primeras líneas mediante `orphans: 3`. Los títulos inline en negrita permanecen dentro de su párrafo.

No se agrupan cláusulas completas ni se aplica `break-inside: avoid` a todos los párrafos. `section` y `article` admiten división. Las tablas ordinarias también permiten división de filas extensas; solo las firmas y los bloques pequeños identificados se mantienen unidos. No se fija el número de páginas ni se fuerza una página nueva para cada sección o para las firmas.

## Transformación presentacional determinista

`presentation.ts` opera sobre el DOM **ya sanitizado**, en memoria. Añade clases internas; no cambia, elimina, reordena ni completa texto contractual:

1. Reconoce bloques hoja con el texto exacto «CONTRATO DE ARRENDAMIENTO», «ANTECEDENTES» o «CLÁUSULAS», ignorando mayúsculas para identificarlos, sin modificar su texto.
2. Reconoce títulos separados en mayúsculas, de hasta 220 caracteres, con ordinal español y terminación de título. Distingue esos títulos de una cláusula con contenido inline. Los encabezados HTML `h1`–`h6` reciben además reglas generales.
3. Identifica párrafos con incisos `a)` y líneas de inventario formadas por guiones bajos.
4. Reconoce conservadoramente tablas de firmas que contengan los rótulos exactos ARRENDADOR y ARRENDATARIO (con EL/LA opcional), además de líneas de guiones bajos. Admite estructuras con párrafos y con `<br>`.
5. En firmas, envuelve únicamente los nodos de texto de líneas/rótulos en spans internos. Conserva nombres, campos vacíos, filas, columnas y `colspan`.

La prueba compara el `textContent` completo antes/después, incluyendo campos vacíos y orden. Las clases procedentes del HTML almacenado siguen siendo eliminadas por la política existente; las nuevas clases son generadas internamente después de DOMPurify. No se amplió la lista de etiquetas ni atributos admitidos.

## Firmas

Solo las tablas reconocidas pierden bordes, fondos y sombras, incluso si proceden de estilos inline. Se mantiene la estructura original: dos columnas para arrendador/arrendatario y fiador centrado cuando el HTML original ya usa `colspan`.

Los rótulos y nombres quedan centrados; se reserva un espacio de 14 mm antes de la línea manuscrita. Celdas y filas evitan división. Si la tabla tiene hasta tres filas y menos de 1,800 caracteres normalizados, se solicita mantener todo el bloque unido. Es una heurística conservadora, no una medición física ni un límite de contenido; Chromium puede dividir bloques que excedan una página.

No se insertan personas, firmas, líneas nuevas o imágenes. Las tablas que no satisfacen el patrón mantienen la presentación general y requieren revisión con su HTML real.

## Folio y pie de página

`historicalFolio.ts` lee `datos_snapshot.contrato.folio` si es una cadena no vacía, de hasta 160 caracteres y sin caracteres de control. Si falta o es inválida, utiliza `nombre_archivo` sin `.pdf`. Los documentos legados no fallan por ausencia del folio.

El servicio entrega al generador el mismo HTML histórico y una opción de presentación `{ folio }`. El generador no recibe el snapshot ni conoce Supabase. El folio se escapa como texto al formar el footer.

Playwright utiliza `displayHeaderFooter: true`, `headerTemplate: '<div></div>'` y un footer autónomo con estilos inline de 8 pt. A la izquierda aparece el folio; a la derecha, «Página X de Y», usando `pageNumber` y `totalPages` de Chromium. Sin fecha, URL, scripts ni fuentes externas. Se revisaron las limitaciones de las [plantillas de pie de Playwright](https://playwright.dev/docs/api/class-page#page-pdf), que no heredan el CSS del documento.

## Seguridad e inmutabilidad

Se mantienen DOMPurify, jsdom sin ejecución de scripts, CSP, JavaScript desactivado en Chromium, service workers bloqueados y abortado de solicitudes de red. Los tests previos de sanitización, permisos, Storage, concurrencia, actualización exclusiva de `storage_path` y recuperación siguen pasando. No se tocó Supabase remoto ni se regeneró un PDF histórico.

## Archivos

Modificados:

- `src/modules/admin/arrendamiento/contratos/documentos/server/types.ts`: opción de folio y snapshot de solo lectura.
- `src/modules/admin/arrendamiento/contratos/documentos/server/documentRepository.ts`: añade snapshot a la consulta existente.
- `src/modules/admin/arrendamiento/contratos/documentos/server/pdfService.ts`: deriva y transmite el folio histórico.
- `src/modules/admin/arrendamiento/contratos/documentos/server/pdf/printHtml.ts`: aplica decoración y CSS al wrapper temporal.
- `src/modules/admin/arrendamiento/contratos/documentos/server/pdf/generator.ts`: opciones de impresión con footer.
- `tests/pdf.chromium.test.mjs`: comprueba texto de pie en cada página cuando se proporciona Python con pypdf.
- `.gitignore`: excluye PDF de muestra y PNG intermedios de QA.

Nuevos:

- `src/modules/admin/arrendamiento/contratos/documentos/server/historicalFolio.ts`.
- `src/modules/admin/arrendamiento/contratos/documentos/server/pdf/layout.ts`.
- `src/modules/admin/arrendamiento/contratos/documentos/server/pdf/presentation.ts`.
- `tests/pdf-layout.test.mjs`.
- `tests/fixtures/pdf-layout.mjs`.
- `tests/generate-pdf-layout-fixture.mjs`.
- `tests/inspect-pdf-layout.py`.
- Este informe.

No se agregaron dependencias de la aplicación. Para QA se usaron las herramientas Python/Poppler incluidas en el entorno de trabajo.

## Pruebas y revisión visual

Se ejecutaron las suites existentes y las nuevas: **88 pruebas aprobadas**, ninguna omitida, incluyendo Chromium real y extracción del footer con pypdf. La generación siguió haciendo cero requests al servidor externo de prueba.

TypeScript: mismos **15 errores preexistentes**, sin diferencias respecto al diagnóstico capturado al inicio. No se corrigieron errores ajenos al módulo. Build y `git diff --check` completados; el adapter conserva Node 22 para Vercel y sus avisos preexistentes de tamaño de chunks/runtime local.

El fixture local contiene solo texto sintético, se identifica como muestra sin validez contractual y tiene **cuatro páginas**. Se renderizaron e inspeccionaron visualmente las cuatro: título, justificación, incisos, inventario, cláusula larga entre páginas 2–3, firmas completas en página 4 y pie en todas las páginas. No se observaron solapamientos ni recortes en esta muestra.

El inspector Python valida además Carta, footer por página, límites horizontales, separación cuerpo/pie, títulos con texto posterior, continuación de cláusula larga, nombres de firmas juntos y ausencia de bordes visibles de tabla. Estas comprobaciones son específicas del fixture, no garantizan la maquetación de cualquier contrato real.

PDF para revisión humana:

`E:/Documentos/Proyectos/Clientes/Regio Rentas/regio-rentas/output/pdf/contrato-maquetacion-2b1.pdf`

Reproducir con Chromium local instalado:

```powershell
node tests/generate-pdf-layout-fixture.mjs
node --test tests/pdf-layout.test.mjs
$env:RUN_PDF_CHROMIUM='1'
# Opcional: ruta de Python con pypdf para verificar texto del footer.
$env:PDF_QA_PYTHON='C:\ruta\python.exe'
node --test tests/*.test.mjs
# Python con pdfplumber para inspección geométrica de la muestra:
python tests/inspect-pdf-layout.py
```

## Limitaciones pendientes

- El PDF real de seis páginas y su HTML no estaban entre los archivos entregados ni en el proyecto. La revisión visual realizada corresponde a la muestra sintética, no a ese contrato. Se recomienda inspeccionar una nueva revisión real antes de usarla para impresión definitiva.
- HTML con títulos no semánticos y formatos distintos de los patrones documentados podría necesitar un ajuste de reconocimiento. No se adivinan firmas ni se reestructuran tablas ambiguas.
- Fuentes de sustitución y separación silábica pueden variar entre Windows y Chromium Linux. No se verificó el resultado visual en Vercel; se conserva la infraestructura que ya funcionaba en 2A.
- Se respetan saltos explícitos que ya existan en el HTML. El espaciado de bloques inusualmente grandes o con numerosos `<br>` merece revisión humana.
- La nueva composición se aplica al PDF aún no generado; los objetos existentes, incluidos los pendientes de reconciliación, conservan su maquetación original.
