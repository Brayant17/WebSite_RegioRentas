# Propuesta local de V2 — Contrato de arrendamiento habitacional

Fuente: HTML aportado por el usuario desde Supabase, versión 8f30e17c-6c5e-4a42-9b66-d0d8348d9520, número 1, BORRADOR. No se consultó Supabase.

V1 de referencia: contrato-habitacional-v1-referencia.html. Copia propuesta completa: contrato-habitacional-v2-propuesta.html. Solo se retiró la envoltura Markdown de la celda; no se reinterpretaron los <br>. Los hashes y sustituciones exactas están en contrato-habitacional-v2-cambios.json. No existe una V2 insertada en Supabase.

## SEGUNDA — fragmento HTML completo

### V1

```html
<p><br><strong>SEGUNDA: POSESIÓN.-</strong><br>EL ARRENDADOR manifiesta que en ESTA FECHA se entregará en arrendamiento<br>EL INMUEBLE objeto del presente contrato, en las condiciones ya descritas<br>en el capítulo de ANTECEDENTES arriba trascrito y previa inspección que<br>EL ARRENDATARIO realice a fin de verificar lo anterior, haciéndole<br>mención de que tendrá que cubrir puntualmente el pago de luz. Ya está<br>incluido en el arrendamiento el servicio de internet y agua para uso<br>personal. El uso de la lavandería sería un costo adicional de $200 pesos<br>mensuales por persona, en caso de requerir dicho servicio.<br></p><br><br>
```

### V2 propuesta

```html
<p><br><strong>SEGUNDA: POSESIÓN.-</strong><br>EL ARRENDADOR manifiesta que en ESTA FECHA se entregará en arrendamiento<br>EL INMUEBLE objeto del presente contrato, en las condiciones ya descritas<br>en el capítulo de ANTECEDENTES arriba trascrito y previa inspección que<br>EL ARRENDATARIO realice a fin de verificar lo anterior, haciéndole<br>mención de que tendrá que cubrir puntualmente el pago de luz. Ya está<br>incluido en el arrendamiento el servicio de internet y agua para uso<br>personal. El uso de la lavandería sería un costo adicional de {{contrato.costo_lavanderia}}<br>mensuales por persona, en caso de requerir dicho servicio.<br></p><br><br>
```

## CUARTA — fragmento HTML completo

### V1

```html
<p><br><strong>CUARTA: VIGENCIA.-</strong><br>EL ARRENDADOR y EL ARRENDATARIO acuerdan y así lo establecen en la<br>presente cláusula, que la duración del presente Contrato es por<br>1 (UN) AÑO forzoso para las partes, contado a partir del<br><strong>{{contrato.fecha_inicio_letra}}</strong>, para concluir el día<br><strong>{{contrato.fecha_fin_letra}}</strong>. En caso de que las partes<br>decidan renovar el contrato el aumento de la renta será tendrá un aumento<br>anual con base al índice de inflación del Banco de México.<br></p><br><br>
```

### V2 propuesta

```html
<p><br><strong>CUARTA: VIGENCIA.-</strong><br>EL ARRENDADOR y EL ARRENDATARIO acuerdan y así lo establecen en la<br>presente cláusula, que la duración del presente Contrato será contada a partir del<br><strong>{{contrato.fecha_inicio_letra}}</strong>, para concluir el día<br><strong>{{contrato.fecha_fin_letra}}</strong>. En caso de que las partes<br>decidan renovar el contrato el aumento de la renta será tendrá un aumento<br>anual con base al índice de inflación del Banco de México.<br></p><br><br>
```

## DÉCIMA — fragmento HTML completo

### V1

```html
<p><br><strong>DÉCIMA: DEL DOMICILIO.-</strong><br>Para todo aviso relacionado con el presente Contrato, las partes<br>firmantes señalan como sus domicilios para todo lo relacionado en el<br>presente Contrato los siguientes:<br></p><br><br><p><br><strong>EL ARRENDADOR:</strong><br><br>{{arrendador.domicilio}}<br><br>{{arrendador.ciudad}}, {{arrendador.estado}},<br>{{arrendador.codigo_postal}}<br></p><br><br><p><br><strong>EL ARRENDATARIO:</strong><br><br>{{arrendatario.domicilio}}<br></p><br><br><p><br><strong>EL FIADOR:</strong><br><br>{{fiador.domicilio}}<br></p><br><br>
```

### V2 propuesta

```html
<p><br><strong>DÉCIMA: DEL DOMICILIO.-</strong><br>Para todo aviso relacionado con el presente Contrato, las partes<br>firmantes señalan como sus domicilios para todo lo relacionado en el<br>presente Contrato los siguientes:<br></p><br><br><p><br><strong>EL ARRENDADOR:</strong><br><br>{{contrato.domicilio_arrendador}}<br></p><br><br><p><br><strong>EL ARRENDATARIO:</strong><br><br>{{contrato.domicilio_arrendatario}}<br></p><br><br><p><br><strong>EL FIADOR:</strong><br><br>{{contrato.domicilio_fiador}}<br></p><br><br>
```

## Diff literal de las cinco sustituciones

### SEGUNDA

```diff
-$200 pesos
+{{contrato.costo_lavanderia}}
```

### CUARTA

```diff
-es por<br>1 (UN) AÑO forzoso para las partes, contado
+será contada
```

### DÉCIMA / ARRENDADOR

```diff
-{{arrendador.domicilio}}<br><br>{{arrendador.ciudad}}, {{arrendador.estado}},<br>{{arrendador.codigo_postal}}
+{{contrato.domicilio_arrendador}}
```

### DÉCIMA / ARRENDATARIO

```diff
-{{arrendatario.domicilio}}
+{{contrato.domicilio_arrendatario}}
```

### DÉCIMA / FIADOR

```diff
-{{fiador.domicilio}}
+{{contrato.domicilio_fiador}}
```

## Compatibilidad que requiere una revisión posterior

- Introducción: «en representación de la sociedad mercantil», arrendador.razon_social y los datos de representante. Para PERSONA quedan campos vacíos dentro de una oración corporativa. arrendador.nombre sirve técnicamente para identificar ambos tipos, pero reemplazar solo el nombre no corrige esa oración.
- Antecedente I: «a través de su» representante; I(a) declara una sociedad anónima de capital variable; I(b) habla de «su representada», facultades, revocación y «su mandante». Una variante para PERSONA necesita texto distinto, que no se redacta ni sustituye aquí.
- Firma: usa razón social, carácter y nombre del representante. Para PERSONA necesita una variante de firma con la identidad del arrendador, sin líneas de representación corporativa. No se modifica.
- El renderer solo sustituye variables: no implementa condicionales ni bloques por tipo. Dos variantes explícitas de plantilla o una futura composición de bloques aprobados requieren una decisión posterior; esta entrega no cambia el motor ni 2B.0.
- PERSONA_MORAL conserva el comportamiento actual y requiere exactamente un representante principal. El texto fijo «sociedad anónima de capital variable» sigue siendo una suposición del original; no se generaliza a otras formas societarias.

## Problemas detectados y preservados

- V2 todavía no es textualmente apta para PERSONA en su conjunto, aunque los 20 placeholders sean conocidos y las tres cláusulas modificadas rendericen correctamente.
- Si lavandería es NULL, queda «costo adicional de  mensuales»; los domicilios NULL quedan vacíos. No se inventó una tarifa ni se añadieron requisitos u omisiones condicionales.
- CUARTA conserva literalmente «el aumento de la renta será tendrá un aumento» y la referencia anual al índice de inflación. No se corrige redacción fuera de la sustitución autorizada.
- Se conservan «Que ... actúan en su nombre y por cuenta propia» y todas las demás declaraciones, sin resolver contradicciones potenciales con representación corporativa.
- Se conserva el HTML recibido, incluidos <br> dentro de la tabla de firmas. No se hizo limpieza ni rediseño del PDF.
- «forzoso para las partes» se retira junto con «1 (UN) AÑO» conforme a la sustitución expresamente solicitada; no se extiende esa modificación a otras cláusulas.

No se modificó V1 en Supabase ni ningún documento, snapshot o PDF histórico. No se generaron documentos ni PDFs y no hubo despliegue.
