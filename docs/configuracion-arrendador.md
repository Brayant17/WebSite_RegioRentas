# Datos del arrendador

Pantalla disponible en `/admin/configuracion/arrendador`, con acceso desde “Datos del arrendador” en el menú administrativo.

## Archivos creados en esta implementación

Rutas relativas a la raíz del repositorio:

| Archivo | Función |
| --- | --- |
| `src/modules/admin/configuracion/arrendador/types.ts` | Tipos de persona moral, representante, formulario y etiquetas de los cuatro caracteres permitidos. |
| `src/modules/admin/configuracion/arrendador/repositories/arrendador.repository.ts` | Consultas y actualizaciones Supabase con campos explícitos. |
| `src/modules/admin/configuracion/arrendador/services/arrendador.service.ts` | Descubrimiento del arrendador, normalización, validación, coordinación del guardado y errores de guardado parcial. |
| `src/modules/admin/configuracion/arrendador/hooks/useLandlordSettings.ts` | Estado de carga, formulario, guardado, errores, éxito y prevención de doble envío. |
| `src/modules/admin/configuracion/arrendador/LandlordSettingsPage.tsx` | Las dos secciones del formulario; estatus e identidad del representante solo para consulta. |
| `src/pages/admin/configuracion/arrendador.astro` | Entrada Astro con AdminLayout y componente React hidratado. |
| `tests/arrendador.test.mjs` | Diez pruebas aisladas con el runner nativo de Node y cliente Supabase sustituido. |
| `docs/configuracion-arrendador.md` | Este informe. |

## Archivos modificados en esta implementación

| Archivo | Cambio |
| --- | --- |
| `src/modules/admin/navigation/admin.navigation.ts` | Reemplaza el enlace vacío “Settings” por “Datos del arrendador”. |
| `package.json` | Agrega `test:arrendador`, sin dependencias nuevas. |

Los cambios locales del módulo de contratos de la tarea anterior se conservaron; no forman parte de esta implementación.

## Consultas Supabase

Todas usan el cliente de navegador existente y la sesión del administrador.

1. `configuracion_sistema`: SELECT `valor` WHERE `clave = 'arrendador_persona_moral_id'`, mediante `maybeSingle`. Se comprueba que sea un UUID válido; nunca se asigna uno fijo.
2. `personas_morales`: SELECT `id`, los nueve campos editables y `estatus` WHERE `id = UUID configurado`.
3. `representantes_persona_moral`: SELECT `id`, `persona_moral_id`, `persona_id`, `caracter`, `es_principal` y relación `personas!persona_id` con nombre, apellidos, teléfono y correo; WHERE `persona_moral_id = UUID configurado AND es_principal = true`.
4. Antes del guardado se repiten las consultas 1 y 3 para detectar si la configuración o la identidad del representante cambió durante la edición.
5. `personas_morales`: UPDATE únicamente `razon_social`, `nombre_comercial`, `rfc`, `domicilio`, `ciudad`, `estado`, `codigo_postal`, `telefono`, `correo`, filtrado por `id`. Devuelve los datos guardados con SELECT.
6. `representantes_persona_moral`: UPDATE únicamente `caracter`, filtrado por `id`, `persona_moral_id`, `persona_id` y `es_principal = true`. Devuelve el registro y su persona mediante SELECT. Solo se realiza si existe representante principal.

No se escriben `personas`, `configuracion_sistema`, `contratos` ni `partes_contrato`. Tampoco se modifican estatus, relaciones o principalidad.

## Arquitectura y guardado

- Se conserva repository → service → hook → UI y Astro para rutas/layout.
- Se reutilizan AdminLayout, Button, Input, Label, Badge, Select y DataItem; Zod ya estaba instalado para validaciones.
- La ruta queda protegida por el middleware `/admin` existente. No se cambian políticas RLS ni se utilizan claves privilegiadas.
- Los campos de texto se recortan con `trim`; los opcionales vacíos se guardan como `null`. Se valida razón social, correo opcional y carácter cuando existe representante.
- La persona moral se guarda primero y el carácter después. Son dos peticiones independientes, sin atomicidad garantizada. No se añadió una RPC ni se implementó una reversión que pudiera sobrescribir cambios concurrentes.
- Si falla la primera actualización, no se intenta la segunda. Si falla la segunda, el mensaje informa que los datos de la persona moral sí se guardaron. El formulario conserva lo capturado y ofrece reintentar o descartar la captura y recargar.
- Las actualizaciones sin fila devuelta se consideran fallo, evitando anunciar éxito ante un registro ausente o sin permisos.
- Durante el guardado se bloquean campos, select y botones; un bloqueo síncrono con referencia evita doble submit antes del siguiente render.
- Al completar ambas actualizaciones se muestran los valores retornados por Supabase y el mensaje de éxito. El mensaje se limpia cuando se vuelve a editar.

## Supuestos y estados excepcionales

- Los campos opcionales de la persona moral admiten `null`, conforme al esquema proporcionado.
- La relación de representante usa la FK `persona_id → personas.id` indicada en la solicitud.
- Se espera como máximo un representante principal por empresa. Varios resultados producen un error; no se escoge uno arbitrariamente.
- Si no existe representante principal, se permite editar solo la persona moral y se informa esta situación. No se crea una relación ni se asigna un carácter por defecto.
- Un carácter vacío o desconocido se muestra sin sustituirlo; el administrador debe elegir una opción válida antes de guardar cuando existe representante.
- Se asume acceso SELECT a la clave de configuración y a la persona relacionada, además de las policies administrativas descritas para las dos tablas editables.
- Las comprobaciones previas reducen el riesgo de guardar una selección obsoleta, pero no constituyen una transacción ni bloquean cambios simultáneos de otros administradores.

## Verificación

- `npm run test:arrendador`: diez pruebas aprobadas. Cubren descubrimiento, ausencia de configuración, validación, normalización, listas de campos permitidos, filtros de representante, guardado parcial, ausencia de filas y cambios de configuración. Requieren Node 24 y no escriben en Supabase real.
- `npm run build`: compilación y empaquetado Astro/Vercel completados correctamente (código de salida 0). Persisten los avisos del proyecto sobre imports sin uso, tamaño del chunk del dashboard y Node local 24 frente al runtime Vercel 22.
- `tsc --noEmit --pretty false`: conserva exactamente los mismos 15 errores preexistentes, sin diagnósticos nuevos. Se comparó la salida completa anterior y posterior; los errores ajenos se dejaron sin corregir.
- No se realizó una comprobación de navegador con sesión administradora real ni se modificaron datos remotos. Queda por verificar la carga y persistencia contra las policies existentes del entorno conectado.

Para la prueba funcional: abrir la ruta como administrador, revisar datos, editar empresa y carácter, guardar y recargar. Comprobar que estatus, persona representante, contactos del representante y selección global permanezcan iguales. Para errores, comprobar que se distingue un fallo previo al guardado de uno posterior al guardado de la persona moral.
