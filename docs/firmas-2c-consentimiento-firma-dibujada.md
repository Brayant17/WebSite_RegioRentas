# Firmas 2C — Consentimiento de firma electrónica simple (PENDIENTE DE REVISIÓN JURÍDICA)

**Estado:** enfoque aprobado por el proyecto y aplicado en `docs/sql/firmas-2c/07_firma_electronica_simple.sql` como `CONSENTIMIENTO_FES_V2`. 07 está instalado en producción. Falta la revisión jurídica. Este texto no es una opinión legal ni garantiza la validez jurídica de la firma.

## Texto vigente: CONSENTIMIENTO_FES_V2

```text
Yo, {nombre}, {calidad}, manifiesto lo siguiente respecto del contrato {folio}, identificado con la huella digital SHA-256 {hash}:

1. Firma electrónica. Acepto firmar este contrato por medios electrónicos.

2. Firma dibujada. Dibujaré mi firma en pantalla y la confirmaré antes de enviarla. Esa imagen quedará vinculada a este documento y se incorporará a su versión final.

3. Verificación por correo. Mi firma solo se completará si ingreso el código de un solo uso que se enviará a {correo}, el correo registrado para mí en este proceso.

4. Conservación. Autorizo que se conserven el documento, mi firma dibujada y las evidencias electrónicas de este proceso, que incluyen fechas y horas, dirección IP, datos del navegador, el correo utilizado y las huellas digitales de la firma y de la evidencia.

5. Contenido del contrato. Declaro que revisé el documento mostrado. Al completar la firma, acepto expresamente su contenido.
```

Una prueba exige que este bloque coincida con lo que genera 07.

### Valor de {calidad}

| Firmante | Texto |
|---|---|
| Persona, por derecho propio | por mi propio derecho, como parte arrendataria |
| Persona moral, `REPRESENTANTE_LEGAL` | en mi carácter de representante legal de Empresa SA de CV, como parte arrendadora |
| Persona moral, `APODERADO_LEGAL` | en mi carácter de apoderado legal de Empresa SA de CV, como parte arrendadora |
| Persona moral, `ADMINISTRADOR` | en mi carácter de administrador de Empresa SA de CV, como parte arrendadora |
| Persona moral, `OTRO` | en representación de Empresa SA de CV, como parte arrendadora |

Esos cuatro son el catálogo de la aplicación (`representativeCharacters`). Una prueba recorre ese catálogo y falla si un código aparece en el texto visible; si se añade otro, necesita redacción propia en 07 **antes de instalar** o una versión nueva después.

`OTRO` no atribuye un carácter ni facultades, porque no hay ninguna registrada.

La columna de la base admite texto libre, aunque generar el documento o iniciar el proceso rechaza lo que no esté en el catálogo. Para un valor fuera de él, 07 no inventa etiquetas: el texto libre se mostraría sin cambios (`Apoderado General`: «con el carácter registrado de «Apoderado General»») y un valor con forma de código se omitiría. El tipo de entidad, no el carácter, decide si alguien actúa por derecho propio.

### Correo

El texto lleva el correo enmascarado, por ejemplo `re***@example.com`. El completo se conserva en `invitaciones_firma`, en `firmas_electronicas` y dentro de la huella de evidencia.

## Decisiones aprobadas

1. Correo enmascarado en el texto y completo en las evidencias internas.
2. El firmante debe desplazarse hasta el final del PDF para habilitar la casilla. **Es un requisito de la interfaz, no una prueba de lectura**, y no se registra como evidencia. Si el documento cabe sin desplazarse, se habilita al terminar de dibujarse.
   Si el navegador no logra mostrar el PDF, la firma queda bloqueada en la interfaz y se le pide abrir el enlace en un navegador compatible; descargarlo no habilita nada.
   Quien ya registró su consentimiento continúa sin repetir el desplazamiento ni aceptar otra vez, siempre que el documento se muestre.
3. La firma se dibuja después de aceptar el consentimiento.
4. La aceptación del contenido solo se considera completada al terminar la firma.
5. El texto no afirma equivalencia automática con una firma autógrafa ni garantiza validez legal.

## Revisión del administrador antes de iniciar

Al confirmar el inicio de firma, el administrador ve la persona moral, su representante, cómo verá el firmante su calidad y un aviso si conviene revisarla, con un enlace a Datos del arrendador. Nada se corrige de forma automática.

| Carácter registrado | Texto de V2 | Interfaz |
|---|---|---|
| `REPRESENTANTE_LEGAL`, `APODERADO_LEGAL`, `ADMINISTRADOR` | en mi carácter de… | Sin aviso |
| `OTRO` | en representación de…, sin indicar un carácter | Aviso |
| Sin representante único, sin carácter o fuera del catálogo | No aplica: generar el documento o iniciar el proceso lo rechaza | Bloquea el inicio |

## Lo que se muestra es lo que se guarda y se firma

- La interfaz muestra el texto que devuelve 07, sin darle formato ni modificarlo.
- Al aceptar, el servidor no recibe el texto del navegador: 07 lo vuelve a generar con la misma función y datos congelados, y guarda ese resultado con su versión.
- El SHA-256 del texto guardado forma parte de `sha256_evidencia`, y esa huella se imprime en la constancia y va en el manifiesto del PDF final.

## Versiones

- `CONSENTIMIENTO_FES_V1`: texto anterior, nunca vigente ni otorgado. Se conserva sin cambios en `firma_privada.texto_consentimiento`. 07 ya no lo acepta.
- `CONSENTIMIENTO_FES_V2`: `firma_privada.texto_consentimiento_v2`, la única versión aceptada.

Si la revisión jurídica pide cambios **antes de instalar**, se ajusta V2 en 07, este documento y su SHA-256. **Después de instalar**, cambiar el texto exige una versión nueva y una migración aparte, porque cada consentimiento guarda el texto exacto que se aceptó.

## Limitaciones pendientes

- **Etiquetas fuera del consentimiento:** la constancia del PDF final y el encabezado del paso 1 comparten `firmas/signerLabels.ts`, y omiten el carácter cuando es `OTRO`. El manifiesto adjunto al PDF conserva los códigos originales (`caracter`, `rol`), porque 07 verifica su hash; el panel del administrador también los muestra, sin guiones bajos.
- **Revisión jurídica:** el texto no está aprobado por jurídico; cualquier cambio altera 07 y su SHA-256.
- **Exactitud del dato:** el texto refleja el carácter capturado, sin comprobar que la persona tenga esas facultades.
- **Bloqueo por PDF no visualizable:** es solo de interfaz. 07 no sabe si el PDF se dibujó en pantalla.
- **Otra persona moral:** Datos del arrendador solo corrige al arrendador configurado.
- **Sin instalar:** 07 solo se ha probado en PGlite, una base temporal en memoria, nunca en Supabase.

## Puntos para la revisión jurídica

1. Quién conserva la información y por cuánto tiempo: el punto 4 no lo indica porque no está definido.
2. Si `/Aviso-de-privacidad` debe cubrir la imagen de la firma y estas evidencias; una búsqueda por palabras clave solo encontró la dirección IP.
3. «Autorizo» o «acepto» en el punto 4, según corresponda para el tratamiento de datos.
4. Si el representante debe declarar además que tiene facultades suficientes.
5. Si la redacción es suficiente para un arrendamiento habitacional y para fiadores y obligados solidarios.
6. La leyenda de la constancia del PDF final: «Esta constancia no es un dictamen sobre la validez jurídica de las firmas».
