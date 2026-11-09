# Motor de plantillas de contratos V1

Flujo: detalle de contrato BORRADOR → **Vista previa del contrato** → selección de plantilla/versión BORRADOR → contexto → renderer puro → sanitización → iframe aislado.

Ruta: `/admin/arrendamiento/contratos/[id]/vista-previa`.

## Archivos creados

Las rutas siguientes son relativas a la raíz del repositorio.

| Archivo | Responsabilidad |
| --- | --- |
| `src/modules/admin/arrendamiento/contratos/plantillas/types.ts` | Contexto serializable y tipos de consultas/versiones/resultado. |
| `src/modules/admin/arrendamiento/contratos/plantillas/utils/formatters.ts` | Nombre completo, DATE, moneda MXN, cantidad en letra, carácter y dirección completa. |
| `src/modules/admin/arrendamiento/contratos/plantillas/services/context.service.ts` | Constructor puro del contexto y comprobaciones de cardinalidad. |
| `src/modules/admin/arrendamiento/contratos/plantillas/renderer.ts` | Catálogo explícito de 51 variables, escaping y sustitución determinista. |
| `src/modules/admin/arrendamiento/contratos/plantillas/repositories/template.repository.ts` | Consultas de contrato/partes/unidad/edificio, representante y versiones. |
| `src/modules/admin/arrendamiento/contratos/plantillas/services/template.service.ts` | Coordinación de consultas y construcción/render de la preview, sin DOM. |
| `src/modules/admin/arrendamiento/contratos/plantillas/sanitize.ts` | DOMPurify y documento aislado con CSP fijo. |
| `src/modules/admin/arrendamiento/contratos/plantillas/hooks/useContractTemplatePreview.ts` | Carga, selección, reintentos, errores y descarte de respuestas obsoletas. |
| `src/modules/admin/arrendamiento/contratos/plantillas/ContractTemplatePreviewPage.tsx` | Selector, advertencias de variables desconocidas e iframe. |
| `src/pages/admin/arrendamiento/contratos/[id]/vista-previa.astro` | Ruta Astro con AdminLayout e isla React. |
| `tests/plantillas.test.mjs` | 24 pruebas unitarias, de consultas sustituidas y sanitización real con DOMPurify/jsdom. |
| `docs/motor-plantillas-v1.md` | Este informe. |

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `src/modules/admin/arrendamiento/contratos/types.ts` | Incorpora `arrendador_persona_moral_id`, `fecha_firma` y `lugar_firma` al modelo actual. |
| `src/modules/admin/arrendamiento/contratos/repositories/contratos.repository.ts` | Incluye esos campos en la consulta existente. |
| `src/modules/admin/arrendamiento/contratos/ContractDetailPage.tsx` | Acción de vista previa únicamente para BORRADOR. |
| `package.json` | DOMPurify como dependencia de runtime, jsdom solo para pruebas, script `test:plantillas`. |
| `package-lock.json` | Resolución reproducible de dependencias y transitivas de las nuevas librerías. |

Se conservan los cambios locales de las tareas anteriores. No se cambian tablas, RPCs, policies ni versiones remotas.

## Consultas

La construcción del contexto hace tres consultas, independientemente del número de participantes:

1. `contratos`, filtrado por `id`: campos contractuales y `arrendador_persona_moral_id`; relación `partes_contrato` → `personas`; relación `unidades!unidad_id` → `edificios!edificio_id`.
2. `personas_morales`, filtrada por **el ID almacenado en el contrato**. Reutiliza `getLandlordCompany` del repository existente de configuración, sin consultar `configuracion_sistema`.
3. `representantes_persona_moral`, filtrada por `persona_moral_id = ID del contrato` y `es_principal = true`, con `personas!persona_id`.

Las consultas 2 y 3 se ejecutan en paralelo después de conocer el contrato. Los participantes provienen exclusivamente de `partes_contrato`; no se reconstruyen desde solicitudes.

Plantillas:

- Listado de `versiones_plantilla` donde `estado = 'BORRADOR'`, relacionado con `plantillas!plantilla_id`. Incluye nombre, descripción, número de versión y estado; no descarga contenido de todas las versiones.
- Consulta de la versión elegida por `id` y `estado = 'BORRADOR'`, ahora incluyendo `contenido`. Se ejecuta en paralelo con la carga del contexto.

Una vista previa requiere cuatro consultas; el listado inicial de opciones es una consulta adicional. No se realiza ninguna escritura.

## Estructura exacta y variables V1

Todas las hojas siguientes son **strings de presentación**. Cada ruta de hoja es una variable permitida: se escribe como `{{ruta}}` o `{{ ruta }}`. Son exactamente 51 variables.

```ts
interface ContractTemplateContext {
  contrato: {
    folio: string;
    fecha_inicio: string;
    fecha_inicio_letra: string;
    fecha_fin: string;
    fecha_fin_letra: string;
    renta: string;
    renta_letra: string;
    deposito: string;
    deposito_letra: string;
    dia_pago: string;
    fecha_firma: string;
    fecha_firma_letra: string;
    lugar_firma: string;
  };
  arrendador: {
    razon_social: string;
    nombre_comercial: string;
    rfc: string;
    domicilio: string;
    ciudad: string;
    estado: string;
    codigo_postal: string;
    telefono: string;
    correo: string;
    representante: {
      nombre_completo: string;
      caracter: string;
      rfc: string;
      curp: string;
      telefono: string;
      correo: string;
    };
  };
  arrendatario: {
    nombre_completo: string;
    rfc: string;
    curp: string;
    domicilio: string;
    telefono: string;
    correo: string;
  };
  fiador: {
    nombre_completo: string;
    rfc: string;
    curp: string;
    domicilio: string;
    telefono: string;
    correo: string;
  };
  inmueble: {
    nombre: string;
    direccion: string;
    ciudad: string;
    estado: string;
    codigo_postal: string;
    direccion_completa: string;
  };
  unidad: {
    nombre: string;
    numero: string;
    tipo: string;
    piso: string;
    ubicacion: string;
  };
}
```

No incorpora funciones, Date, conexiones ni componentes React; se puede serializar directamente con JSON. El contexto no se persiste en esta etapa.

## Derivación y validación

- Los nombres y textos se recortan y normalizan espacios; los componentes ausentes se omiten. `null`, `undefined` y sus representaciones textuales producen `""`.
- Las fechas DATE se validan por componentes/calendario, sin construir Date ni usar la zona horaria. Se muestran como `01/10/2026` y `1 de octubre de 2026`.
- Moneda: `$12,000.50`. Cantidad en letra: `DOCE MIL PESOS 50/100 M.N.`. Implementación local hasta `9,999,999,999.99`, el rango no negativo de `numeric(12,2)`; no acepta separadores ambiguos, más de dos decimales ni redondeos silenciosos.
- El carácter reutiliza las etiquetas existentes: Representante legal, Apoderado legal, Administrador y Otro.
- `inmueble.direccion_completa` combina dirección, ciudad, estado y código postal del edificio. No incorpora unidad.
- Debe existir exactamente un ARRENDATARIO con persona consultable; cero o varios producen error.
- Cero fiadores deja todas las hojas `fiador.*` vacías; más de uno produce error. Un fiador vinculado pero sin persona consultable también produce error.
- Debe existir exactamente un representante principal y su persona debe estar disponible.
- La persona moral debe corresponder al ID almacenado en el contrato. No hay fallback al arrendador global.

## Renderer y sanitización

`renderContractTemplate(templateHtml, context)` devuelve `{ html, unresolvedVariables }`. Es puro y no consulta Supabase ni el DOM. Hace una sola pasada, sustituye todas las apariciones y no reinterpreta placeholders contenidos dentro de los valores de personas u otros datos.

El catálogo explícito contiene solo las 51 rutas V1. No se ejecuta código ni se usa `eval`. Las variables desconocidas quedan entre llaves y se reportan sin duplicados, ordenadas; se informa de ellas antes de mostrar el iframe. Los campos conocidos y vacíos no se consideran variables desconocidas.

Los valores se escapan antes de insertarlos. Además de `&`, `<`, `>`, comillas, se escapan espacios, acento grave y `=`, evitando que un valor abra atributos incluso si la plantilla los escribió sin comillas.

El resultado se sanitiza en el navegador con [DOMPurify](https://github.com/cure53/DOMPurify), versión instalada **3.4.15**. Se usa una lista permitida de elementos de texto y tablas y de atributos de presentación (`style`, `colspan`, `rowspan`, `scope`, `dir`, `lang`). Se eliminan scripts, handlers, links, imágenes, formularios, iframes, SVG/MathML, metadatos, estilos de bloque y otros elementos no permitidos. Las declaraciones de estilo en línea se conservan dentro del frame; no se aplica CSS de plantilla al panel administrativo.

No se utiliza `dangerouslySetInnerHTML`. React recibe un `srcDoc` sanitizado en un iframe con `sandbox=""`, sin `allow-scripts` ni `allow-same-origin`. El documento fija CSP con `default-src 'none'`, `script-src 'none'`, conexiones/imágenes/fuentes deshabilitadas, `base-uri 'none'` y `form-action 'none'`. Solo se permiten estilos en línea para presentación. No se cargan recursos externos de las plantillas.

La sanitización falla de forma cerrada si el navegador no es compatible. DOMPurify solo se invoca después de hidratar la isla React; no se incorpora jsdom al bundle de producción. **jsdom 30.1.1** es dependencia de desarrollo para probar el sanitizer real.

## Selección y supuestos

- Se muestran versiones cuyo estado es exactamente `BORRADOR`, con su plantilla asociada. Se presupone el estado en mayúsculas según el modelo suministrado.
- Una única versión se selecciona automáticamente; varias requieren selección explícita. No se hardcodean IDs ni se elige automáticamente “la primera” o “la más reciente”.
- La plantilla padre debe poder consultarse. El filtro se aplica al estado de la versión; no se inventan restricciones adicionales sobre el estado de la plantilla padre.
- Solo se ofrece preview para contratos BORRADOR y también se comprueba ese estado al cargar contexto, incluso si se abre directamente la ruta.
- Una unidad inexistente/inaccesible produce error. Si la unidad no tiene edificio disponible, `inmueble.*` queda vacío.
- Los importes y fechas inválidos se reportan; los nulos opcionales producen vacíos. Un carácter no reconocido produce error.
- Las consultas usan las FK descritas y las policies existentes del administrador. La ruta reutiliza la protección `/admin`.
- La preview refleja datos consultados en ese momento; las consultas no constituyen un snapshot histórico ni una transacción. Puede actualizarse desde la pantalla.

## Pruebas

- `npm run test:plantillas`: **24 aprobadas**. Nombre, fechas, moneda, letras/centavos/apócopes/millones, dirección, caracteres, catálogo completo, repetición, espacios, desconocidas, nulos, escaping, cardinalidades, contexto JSON, consultas Supabase sustituidas, descubrimiento de versiones y seguridad del HTML.
- `node --test tests/contratos.test.mjs tests/arrendador.test.mjs`: **19 aprobadas**, conservando los flujos anteriores.
- TypeScript comparado antes/después: mismos **15 errores preexistentes**, sin nuevos diagnósticos.
- `git diff --check`: correcto.
- `npm run build`: **correcto**, compilación Astro y empaquetado Vercel terminados con código 0. Persisten los avisos de imports sin uso, tamaño del chunk del dashboard y Node local 24 frente al runtime Vercel 22.

Las pruebas de sanitizer usan DOMPurify real sobre jsdom; las pruebas de consultas sustituyen Supabase y no escriben datos reales. Ejecutadas con Node 24.16.0; jsdom requiere una versión compatible de Node (24.15+ en la rama 24).

No se ha realizado una prueba de navegador con contrato y sesión administradora reales. Falta confirmar permisos SELECT y relaciones del entorno remoto y revisar visualmente una plantilla real. No se generaron PDF/DOCX, documentos definitivos, snapshots ni cambios de versión.
