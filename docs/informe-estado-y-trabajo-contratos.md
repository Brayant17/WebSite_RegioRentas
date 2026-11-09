# Informe de trabajo y estado del módulo de contratos

**Fecha del informe:** 6 de noviembre de 2026  
**Proyecto:** Regio Rentas  
**Alcance:** cambios de Partes 2B.0, Contratos 2B.2 y preparación de Firma 2C reflejados en el historial de trabajo y en el repositorio actual.

## Resumen ejecutivo

El módulo evolucionó desde la edición y generación de contratos hasta la preparación de un proceso de firma con versiones congeladas del documento, participantes identificados por su rol y evidencia separada. En 2B.0 se habilitó cambiar el arrendador entre persona física y moral. En 2B.2 se añadieron datos propios de cada contrato, se incorporaron al contexto y a los snapshots de nuevas generaciones, y se preparó y validó la plantilla V2. También se permitió capturar lugar y fecha de firma sin que eso signifique que el contrato ya esté firmado.

Para 2C se diseñaron controles de base de datos y se añadieron partes de la experiencia y del servidor de firma al código local. **La disponibilidad real de 2C depende de qué migraciones fueron instaladas en Supabase.** Los documentos del repositorio contienen estados contradictorios respecto a la migración de etapa 1; por eso este informe no afirma que toda la infraestructura 2C esté activa.

No tuve conexión directa a Supabase. Nunca ejecuté SQL remoto, no hice despliegues ni realicé cambios de datos en la base. Cuando el historial indica que una migración fue aplicada, fue una operación manual tuya, seguida de resultados que compartiste.

## 1. Qué se implementó conceptualmente

### 1.1 Arrendador variable — Partes 2B.0

Un contrato puede tener como arrendador una `PERSONA` o una `PERSONA_MORAL`. La relación queda registrada en `partes_contrato` con el rol `ARRENDADOR`; la entidad concreta se conserva en la columna que corresponda. La aplicación mantiene compatibilidad con la columna transitoria `contratos.arrendador_persona_moral_id` y con la RPC antigua de seis argumentos. Esa compatibilidad se dejó para una migración futura, no se retiró al cerrar 2B.0.

La plantilla contractual permanece única. Para los párrafos jurídicos cuya redacción depende del tipo de arrendador, el contexto prepara tres bloques: comparecencia, antecedentes de identidad y firma. La versión moral reproduce literalmente los fragmentos aprobados de V1. El renderer solo permite insertar HTML sin escapar en esos tres placeholders; los datos que se interpolan dentro de ellos se escapan y el HTML final conserva la sanitización existente. No se inventó redacción para persona física: una plantilla que requiera los bloques falla explícitamente si se intenta usar con una persona física sin texto jurídico aprobado.

### 1.2 Datos contractuales variables — Contratos 2B.2

Se añadieron a la edición del contrato BORRADOR el costo de lavandería, los tres domicilios contractuales, el lugar de firma y la fecha de firma. Son valores del contrato particular: no se copian automáticamente de los perfiles. Los campos opcionales vacíos se guardan como `NULL`; lavandería admite cero y rechaza valores negativos. Lugar y fecha de firma no cambian el estado del contrato.

El servicio de contexto incorpora esos datos a las nuevas generaciones. Los valores NULL producen texto vacío, el cero se presenta como importe y el costo conserva además su valor numérico sin confundirlo con la cadena formateada. Las nuevas generaciones guardan una copia del contexto y el HTML renderizado en `documentos_contrato`; la lectura histórica no reconstruye esos datos desde el contrato actual. Así, editar el contrato después no reescribe los documentos anteriores.

### 1.3 Plantilla V2

V2 fue creada como otra versión de la misma plantilla, sin reemplazar V1. Incluye los cambios aprobados: costo de lavandería variable, vigencia calculada mediante fechas de inicio y fin, y domicilios específicos del contrato. Más tarde se ajustó la maquetación para que los párrafos fluyan como párrafos, se mantengan separados los antecedentes y cada inciso de OCTAVA/NOVENA, y los `<br>` se reserven para separaciones que realmente deben aparecer como líneas distintas.

Los bloques del arrendador se incorporaron a V2 para evitar duplicar toda la plantilla. La composición de V2 se verificó con arrendador moral; el intento con persona física debe detenerse porque aún falta aprobar sus textos legales. No se modificó V1 ni se reescribieron los snapshots históricos.

### 1.4 Preparación de firma — 2C

El diseño propone congelar el documento seleccionado antes de iniciar la firma, asociar cada firmante a una parte y a su rol contractual, conservar el PDF original y guardar el PDF firmado como una evidencia separada. También contempla bloquear cambios contractuales mientras el contrato está `PENDIENTE_FIRMA`, registrar cada firma por separado y permitir cancelación o anulación con reglas explícitas.

En el repositorio actual hay componentes administrativos, rutas de servidor y una experiencia pública de firma. El flujo electrónico simple de la migración `07_firma_electronica_simple.sql` incluye enlace privado, consentimiento, firma dibujada y código de un solo uso. Según informaste, `07` ya está instalado en producción y el flujo completo se probó con tres firmantes, incluido el PDF final. El código de OTP disponible imprime el código en la terminal solo en desarrollo; no hay proveedor de correo configurado y, por tanto, no está listo para firma en producción.

## 2. Cambios físicos en el repositorio

Los cambios están repartidos entre los siguientes archivos y áreas:

| Área | Archivos/ubicación representativos | Efecto |
| --- | --- | --- |
| Edición y lectura de contratos | `src/modules/admin/arrendamiento/contratos/ContractDetailPage.tsx`, `components/ContractForm.tsx`, `services/contratos.service.ts`, `repositories/contratos.repository.ts`, `types.ts` | Formulario BORRADOR, validación, normalización y lectura/escritura de campos contractuales. |
| Contexto y render contractual | `src/modules/admin/arrendamiento/contratos/plantillas/` | Contexto, variables, bloques del arrendador, escape selectivo y sanitización. |
| Plantilla | `docs/plantillas/contrato-habitacional-v1-referencia.html`, `contrato-habitacional-v2-final.html` y archivos Markdown asociados | Referencia local de V1, propuesta final de V2 y explicación del cambio de maquetación. V1 de producción nunca se modificó. |
| SQL manual 2B | `docs/sql/partes-2b0/` y `docs/sql/contratos-2b2/` | Migraciones/consultas para revisión y ejecución manual. No son parte del flujo de ejecución de la app. |
| Firma 2C | `src/modules/admin/arrendamiento/contratos/firmas/`, `src/pages/api/.../firma*`, `src/pages/firmar.astro` | Tipos, panel, endpoints, carga/consulta y experiencia del firmante presentes localmente en diferentes etapas. Su operatividad depende del esquema instalado y de la configuración externa. |
| SQL de firma | `docs/sql/firmas-2c/` | Preflights de solo lectura y propuestas de infraestructura para las etapas 1 y 2 y firma electrónica. La propuesta original `01` se conserva como historial; `02` la sustituye. `04` y `07` son diseños alternativos posteriores, no se deben instalar ambos. |
| Pruebas y documentación | `tests/` y `docs/firmas-2c-*.md` | Cobertura de contexto, renderer, SQL modelado en PGlite, interfaz y flujo de firma, además de límites y pasos manuales. |

En el árbol de trabajo actual hay archivos modificados y archivos nuevos sin confirmar en Git. No se hizo commit como parte de este informe. Por eso el estado que describo corresponde a este checkout y no a una versión desplegada o publicada.

## 3. Estado de base de datos según la información disponible

### Cambios confirmados manualmente por el usuario

| Cambio | Estado que conozco |
| --- | --- |
| Partes 2B.0: esquema e RPC de arrendador explícito | Informaste que `01_esquema.sql` y `02_rpc.sql` fueron aplicados y verificados en Supabase. También reportaste cero inconsistencias de integridad y una prueba manual exitosa cambiando el arrendador de persona moral a física y de regreso. |
| Datos de edición 2B.2 | Informaste que los cuatro campos contractuales ya existían y que UI → guardar → recargar quedó validado. No se creó esquema para esos campos. Lugar/fecha de firma también se modelaron como columnas existentes, sin migración de base. |
| Plantilla V2 | Informaste que `03_plantilla_v2.sql` insertó V2 como BORRADOR para la misma plantilla. Después informaste que `04_maquetacion_plantilla_v2.sql` actualizó exclusivamente el contenido de esa V2. V1 permaneció BORRADOR e intacta, según tus verificaciones. |
| Documento y PDF de 2B.2 | Informaste que la V2, el snapshot, el PDF generado y la descarga fueron validados manualmente. No generé ni reemplacé esos artefactos en Supabase. |

La V1 verificada por ti tenía ID `8f30e17c-6c5e-4a42-9b66-d0d8348d9520`, versión 1 y hash MD5 `d704f77fe239de4baa7f3ba952717a4e`. V2 tenía ID `599b36af-5464-43bc-acf8-a6a72afaf2ef`, versión 2 y estado BORRADOR. Tras insertar V2 reportaste MD5 `97b9c89e8721800998824378afece717`; tras la actualización de maquetación reportaste `1f6319e32204303ea4dc13c6353858e7`. La diferencia de hash con el archivo local se diagnosticó como representación de saltos LF/CRLF; reportaste que no cambiaron las palabras contractuales.

### Firma 2C: punto que requiere confirmación

La documentación posterior registra resultados de verificaciones reales con un proceso PENDIENTE, uno CANCELADO y seis firmantes PENDIENTE, lo que indica que la infraestructura de etapa 1 pudo haber sido instalada. Pero `docs/firmas-2c-etapa1-correccion.md` todavía dice que `02_infraestructura_corregida.sql` no fue ejecutado. No puedo reconciliar esa contradicción sin una consulta actual de solo lectura en Supabase.

Informaste después que `07_firma_electronica_simple.sql` está instalado en Supabase de producción y que el flujo completo con tres firmantes, incluida la generación del PDF final, se probó con éxito. La propuesta anterior de firma autógrafa (etapa 2, SQL 04 con sus verificaciones 05 y 06) se descartó en favor de 07 y no forma parte del repositorio; no debe instalarse.

Las migraciones 2C son SQL defensivo diseñado para revisión manual. Deben revisarse contra el esquema y los permisos reales y probarse en una base desechable antes de producción. Las pruebas PGlite no reproducen completamente Supabase Auth, RLS, concurrencia ni la API de Storage.

## 4. Qué se ejecutó

### Acciones locales registradas durante el trabajo

- Se revisaron archivos y flujos existentes, se modificaron componentes/servicios/renderer/plantillas y se añadieron pruebas y SQL manual.
- Se ejecutaron históricamente pruebas de las áreas de contratos, partes, documentos, plantillas, arrendador y PDF. El registro de 2C etapa 1 informa resultados positivos de 44 pruebas de partes, 16 de contratos, 17 de documentos, 43 de plantillas, 10 de arrendador y 23 de PDF.
- El mismo registro indica un fallo de `plantilla-v2-sql.test.mjs` por una precondición de hash de plantilla. Ese fallo se documentó como previo a la entrega 2C y ajeno a esa etapa. No debe ocultarse al valorar las pruebas de aquel momento.
- Las pruebas específicas 2C se modelaron en PGlite con un esquema de prueba y controles de permisos/transiciones. Eso no equivale a aplicar las migraciones en Supabase.
- En este turno preparé este informe. No ejecuté tests ni build nuevos, ni ejecuté comandos contra Supabase.

### Operaciones manuales reportadas por el usuario

Las aplicaciones de SQL 2B.0 y de los scripts de V2, así como las validaciones funcionales y de PDF, las realizaste tú en Supabase y en tu entorno. No tengo acceso a sus sesiones ni puedo certificar un estado actual más allá de los resultados que compartiste.

## 5. Cómo queda el software

- Los contratos BORRADOR pueden guardar y volver a leer los campos 2B.2 y seleccionar persona física o moral como arrendador.
- La generación conserva snapshots de las nuevas generaciones. Los documentos previos no se reconstruyen a partir de datos actuales del contrato.
- V2 está preparada localmente con placeholders variables y bloques de arrendador; la V2 en Supabase fue reportada como BORRADOR. En consecuencia, el estado BORRADOR por sí solo no demuestra que el selector de generación la use: el flujo debe seleccionarse de acuerdo con la lógica actual de plantilla y/o su estado activado.
- Los datos `fecha_firma` y `lugar_firma` son campos de contenido contractual, no una señal de firma ni una transición de estado.
- Hay infraestructura y pantallas/rutas locales para firma, pero la firma 2C no debe considerarse lista para producción hasta conciliar la migración de etapa 1, instalar y validar una única vía de firma compatible, revisar permisos/Storage y configurar un canal real de OTP/correo. El SQL `04` y `07` no son acumulables: `07` declara que sustituye a `04`.

## 6. Cómo queda la base de datos

Según los resultados comunicados por ti, la base tiene Partes 2B.0 aplicada, los campos contractuales usados por 2B.2, y las versiones 1 y 2 de la plantilla sin que V1 fuera obsoletada automáticamente. Las nuevas columnas de los cuatro campos contractuales no fueron creadas por estas tareas porque ya existían. El estado de V2 reportado fue BORRADOR.

La situación de las tablas/RPC/triggers 2C requiere reconfirmación, por la contradicción documental indicada. No se ejecutó ningún SQL remoto desde esta sesión. Los archivos SQL presentes son scripts manuales; no se ejecutan automáticamente al arrancar la aplicación.

## 7. Pendientes importantes

1. Confirmar en Supabase, con consultas de solo lectura, si está instalada `02_infraestructura_corregida.sql` y qué filas actuales hay en `procesos_firma`, `firmantes_proceso` y `evidencias_firma`.
2. La decisión vigente es la firma electrónica simple (`07`), ya instalada. La firma autógrafa (`04`) quedó descartada y no debe instalarse.
3. Revisar/aprobar jurídicamente el texto de consentimiento de `07`; configurar y probar un canal de código accesible solo al firmante. La consola de desarrollo no es un canal de producción.
4. Completar pruebas en entorno Supabase de prueba para RLS, Storage, concurrencia, transacciones y rutas servidor; PGlite no cubre esos servicios reales.
5. Confirmar la regla de selección de versión de plantilla y el momento en que V2 pasará de BORRADOR al estado que la generación usa como vigente. No se reporta aquí ningún cambio de estado ejecutado.
6. Confirmar que los cambios locales actuales están probados y, cuando decidas, integrarlos/commitearlos y desplegarlos por tu proceso habitual. Este informe no hizo commit ni despliegue.

## 8. Fuentes locales para revisar el detalle

- [Contexto y snapshots 2B.2](contratos-2b2-contexto.md)
- [Referencia V1](plantillas/contrato-habitacional-v1-referencia.html)
- [Plantilla V2 final](plantillas/contrato-habitacional-v2-final.html)
- [Migraciones de partes 2B.0](sql/partes-2b0/)
- [Migraciones de plantilla 2B.2](sql/contratos-2b2/)
- [Diseño y corrección 2C etapa 1](firmas-2c-etapa1-correccion.md)
- [Flujo electrónico local y sus limitaciones](firmas-2c-flujo-firmante.md)
- [SQL 2C](sql/firmas-2c/)

---

**Nota de alcance:** este documento describe el estado que entiendo a partir del historial disponible, los resultados que compartiste y los archivos del checkout. No es una exportación de la base ni una certificación de producción. Donde las fuentes discrepan o falta una verificación actual, lo señalé en vez de inferirlo como un hecho.
