# Contratos 2B.2 — contexto y snapshots de nuevas generaciones

El repositorio de plantillas consulta costo_lavanderia, domicilio_arrendador, domicilio_arrendatario y domicilio_fiador desde public.contratos. El servicio de contexto los incorpora para PERSONA y PERSONA_MORAL, sin cambios en la resolución del arrendador.

Placeholders de presentación:

- {{contrato.costo_lavanderia}}: MXN con dos decimales y separadores, por ejemplo $1,250.13.
- {{contrato.domicilio_arrendador}}
- {{contrato.domicilio_arrendatario}}
- {{contrato.domicilio_fiador}}

NULL o ausencia producen texto vacío. Cero produce $0.00. Los domicilios siguen templateText (limpieza de espacios y valores null/undefined); no reemplazan los domicilios de personas o empresas ni se completan desde ellos.

El contexto conserva además valores_contractuales.costo_lavanderia como number|null, separado del texto formateado y sin su redondeo de presentación. No es un placeholder. Ejemplo: 1250.125 como valor numérico y $1,250.13 como presentación. Se mantiene la representación numérica JavaScript utilizada por el frontend; no se incorpora un motor decimal arbitrario.

El servicio de generación existente guarda structuredClone(prepared.context) en datos_snapshot y el HTML de ese mismo contexto en contenido_renderizado. No fue necesario cambiar dicho servicio. Los campos nuevos son opcionales en el tipo del contexto para admitir snapshots anteriores, pero se generan siempre en contextos nuevos.

La lectura histórica sigue consultando únicamente documentos_contrato: no añade claves faltantes, no reconstruye el contexto y no recalcula HTML. No hay migraciones, actualizaciones masivas, cambios de plantillas legales, generación de PDFs ni operaciones remotas en esta entrega.

Las pruebas locales cubren los campos informados/vacíos/cero, selección de columnas, variables anteriores, snapshots nuevos para física/moral y comparación exacta del snapshot y HTML histórico después de cambiar el contrato simulado.
