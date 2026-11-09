# Módulo de contratos

Flujo implementado: solicitud aprobada → formulario → contrato BORRADOR → consulta → edición del borrador.

## Archivos creados

Las rutas de esta tabla son relativas a la raíz del repositorio.

| Archivo | Responsabilidad |
| --- | --- |
| `src/modules/admin/arrendamiento/contratos/types.ts` | Contratos, estados, roles, personas, contexto de solicitud y campos editables. |
| `src/modules/admin/arrendamiento/contratos/repositories/contratos.repository.ts` | Listado, detalle con partes y unidad/edificio, búsqueda por solicitud, contexto del formulario, RPC y actualización condicionada a BORRADOR. |
| `src/modules/admin/arrendamiento/contratos/services/contratos.service.ts` | Operaciones de aplicación, validación de captura, conversión conservadora de importes y mensajes de error. |
| `src/modules/admin/arrendamiento/contratos/hooks/useContracts.ts` | Consultas con carga/error/reintento, descarte de respuestas obsoletas, mutaciones y recuperación de contrato después de errores. |
| `src/modules/admin/arrendamiento/contratos/components/ApplicationContractAction.tsx` | Acción de solicitud: consultar existencia, generar si está aprobada o ver el contrato existente. |
| `src/modules/admin/arrendamiento/contratos/components/ContractForm.tsx` | Formulario compartido de creación/edición con únicamente los cinco campos permitidos. |
| `src/modules/admin/arrendamiento/contratos/components/ContractShared.tsx` | Enlaces, presentación de fechas/importes/personas y estado de error con reintento. |
| `src/modules/admin/arrendamiento/contratos/ContractsPage.tsx` | Listado con búsqueda y paginación local, estados vacíos y acceso a solicitudes. |
| `src/modules/admin/arrendamiento/contratos/CreateContractPage.tsx` | Contexto de solicitud, precarga, creación y acceso al contrato creado o recuperado. |
| `src/modules/admin/arrendamiento/contratos/ContractDetailPage.tsx` | Consulta de condiciones y partes; edición disponible únicamente en BORRADOR. |
| `src/pages/admin/arrendamiento/contratos/nuevo.astro` | Ruta de creación con parámetro de consulta `solicitud`. |
| `src/pages/admin/arrendamiento/contratos/[id].astro` | Ruta del detalle. |
| `tests/contratos.test.mjs` | Nueve pruebas aisladas de captura, contrato de RPC, consulta, errores y restricciones de actualización. |
| `docs/contratos.md` | Resumen de implementación y guía de verificación. |

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `src/modules/admin/arrendamiento/TableArrendamiento.tsx` | Integra la acción de contratos en cada solicitud. |
| `src/modules/admin/arrendamiento/repositories/solicitudes.repository.ts` | Retira la creación de prueba con identificadores y condiciones fijos, y un import sin uso. |
| `src/modules/admin/arrendamiento/services/solicitudes.service.ts` | Cambiar el estado de una solicitud deja de disparar la creación de prueba. |
| `src/pages/admin/arrendamiento/contratos.astro` | Sustituye el anuncio de “Próximamente” por el listado. |
| `package.json` | Añade `test:contratos` sin nuevas dependencias. |

## Decisiones técnicas

- Se conserva Astro → React y repository → service → hook → UI. Se reutilizan AdminLayout, Button, Input, Label, Badge, Table y DataItem.
- Todas las rutas nuevas quedan dentro de `/admin`, protegido por el middleware existente mediante sesión y `users.role = 'admin'`.
- La creación solo invoca `crear_contrato_desde_solicitud` con sus seis parámetros. PostgreSQL sigue asignando folio, unidad, estado y partes; no se modificaron tablas ni RPCs.
- La edición envía una lista explícita de cinco campos y aplica `.eq('estado', 'BORRADOR')` en el UPDATE. Una respuesta sin fila no se considera éxito. Los permisos de acceso a tablas siguen dependiendo de las políticas RLS existentes.
- La validación de captura ofrece feedback local; no sustituye las reglas de PostgreSQL.
- La renta textual solo se precarga si es un decimal sin moneda ni separadores de miles, con hasta dos decimales y dentro del rango de `numeric(12,2)`. Un texto ambiguo se muestra al administrador y requiere captura manual.
- Fechas de contrato se presentan sin conversión de zona horaria. Renta y depósito se muestran en MXN.
- Se bloquean envíos simultáneos durante la mutación. Ante un error de creación se vuelve a consultar si ya existe contrato, lo que permite recuperarlo tras una respuesta de red perdida o creación concurrente.
- No existe caché compartida de consultas en este proyecto: las mutaciones refrescan el estado local y la navegación entre páginas Astro vuelve a consultar los datos. No se agrega una librería de caché.
- El listado usa paginación local, como solicitudes; está sujeto al límite de filas configurado en Supabase.

## Verificaciones

- `npm run test:contratos`: nueve pruebas aprobadas. Usa Node 24 y el runner nativo; sustituye el cliente Supabase, sin escribir datos reales.
- `npm run build`: compilación de Astro y empaquetado de Vercel correctos. El proyecto emite avisos de imports no usados, tamaño de un chunk del dashboard y diferencia entre Node local 24 y runtime Vercel 22.
- `tsc --noEmit --pretty false`: conserva los mismos 15 errores preexistentes; comparación realizada antes y después, sin nuevos diagnósticos. Afectan UnitCardOld, DropDownActions, BrokerTab, DocumentsStep, GuarantorStep, SummaryStep, rentalStore y useProperties del marketplace.
- No hay scripts de lint ni una suite general de pruebas configurados.

## Comprobación pendiente con Supabase autenticado

No se realizó una prueba de navegador con una sesión administradora real ni se verificaron las políticas RLS remotas. La compilación y las pruebas aisladas no sustituyen esa comprobación.

1. Abrir Solicitudes como administrador. Una solicitud aprobada sin contrato debe ofrecer “Generar contrato”; una con contrato debe ofrecer “Ver contrato”.
2. Abrir creación y comprobar fecha estimada, renta, unidad y participantes. Completar los cinco campos y confirmar.
3. Verificar el mensaje de éxito y abrir el contrato. Comprobar folio, BORRADOR, condiciones, edificio y partes asignadas por la RPC.
4. Volver a Solicitudes y comprobar que aparece “Ver contrato”.
5. Editar el borrador, guardar y recargar el detalle para comprobar persistencia.
6. Consultar un contrato que ya esté en otro estado: no debe ofrecer edición. No se incluyen controles para cambiar su estado.
7. Verificar permisos de lectura de `contratos`, `partes_contrato`, `personas`, `unidades` y `edificios`, y de actualización de borradores para el administrador.

El alcance termina en creación, consulta y edición del borrador.
