# V2: maquetación de párrafos naturales

HTML actual: contrato-habitacional-v2-final.html.
MD5 nuevo: 947d28444ab2849f6c9ff20b1cbd2ed6.
SQL manual pendiente: ../sql/contratos-2b2/04_maquetacion_plantilla_v2.sql.
Origen exacto anterior: literal v2html de 03_plantilla_v2.sql, MD5 97b9c89e8721800998824378afece717.
03 se conserva intacto como registro de la inserción original.

Se eliminaron 352 de 381 etiquetas br del HTML principal. Permanecen 29: ocho del inventario y 21 de firmas.
OCTAVA: 11 párrafos independientes a–k. NOVENA: cinco párrafos a–e.
Se conservan los párrafos de antecedentes, títulos, palabras, puntuación y todos los placeholders.

Los bloques usan la revisión arrendador-v2-moral-maquetacion-1 para nuevas construcciones de contexto. Comparecencia y antecedentes eliminan br artificiales; firma conserva sus saltos semánticos. La definición anterior arrendador-v1-moral-1 permanece disponible e intacta. No se cambia contenido histórico.
El HTML actualizado en Supabase y el código nuevo de bloques deben usarse juntos para ver el resultado completo; este trabajo no despliega ni ejecuta la migración.

04 exige el ID 599b36af-5464-43bc-acf8-a6a72afaf2ef, versión 2, BORRADOR y el MD5 anterior exacto, bloquea la fila y actualiza solo contenido. Una segunda ejecución aborta por hash distinto. No actualiza estados, created_at, plantilla_id ni documentos.

CSS sin cambios: createPreviewDocument usa Georgia 16px/1.6 en preview y visor histórico HTML; PDF tiene layout separado Arial 11pt/1.45.

Pruebas de texto: comparación de texto DOM normalizando solo separaciones HTML/espaciado; comparación del orden y contenido de placeholders; estructura de incisos; firmas e inventario; bloqueo PERSONA; snapshot. SQL probado exclusivamente con PGlite local, incluyendo abortos y conservación de otras columnas/históricos.
