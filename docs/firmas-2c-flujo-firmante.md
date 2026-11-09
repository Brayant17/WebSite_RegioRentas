# Firma electrónica simple: flujo del firmante

El participante firma desde un enlace privado, sin cuenta de usuario. La página y las rutas usan las RPC de `docs/sql/firmas-2c/07_firma_electronica_simple.sql`, instalado en Supabase de producción. No volver a ejecutarlo: es una instalación única.

## Flujo

1. El administrador pulsa «Generar enlace» en el panel del proceso. El servidor genera el token, guarda solo su hash y devuelve el enlace una sola vez. El administrador lo copia y lo comparte por su cuenta: **no se envía ningún correo**.
2. El enlace es `https://<sitio>/firmar#t=<token>`. El token va en el fragmento: no llega a los registros de acceso ni al Referer. Cargar la página no cambia nada por sí solo; un programa que solo descarga el enlace no genera eventos.
3. Paso 1: PDF exacto, huella SHA-256 y consentimiento. El servidor registra la visualización con el hash de los bytes entregados, y el navegador lo vuelve a comprobar. La casilla se habilita al llegar al final del PDF; es un requisito de la interfaz, no una prueba de lectura.
4. Paso 2: firma dibujada con dedo, lápiz o ratón.
5. Paso 3: código de un solo uso, confirmación de la firma y envío. En desarrollo, el código aparece en la terminal del servidor (ver abajo).
6. Resultado. La última firma intenta generar y registrar el PDF final; si falla, la firma queda registrada y la recuperación programada lo reintenta. Al completarse, el panel ofrece «Ver PDF final» y «Descargar PDF final».

## Enlaces de invitación

El sistema guarda solo el hash del token, así que un enlace no se puede volver a consultar. El panel lo conserva en memoria mientras no se salga de la página o se recargue. Después solo muestra el estado de la invitación (vigente, vencida, revocada o usada). Si el enlace se perdió, «Generar enlace nuevo» lo reemplaza: el anterior deja de funcionar y el firmante repite la revisión y el consentimiento.

## Código de verificación sin correo

No hay integración con un proveedor de correo. El único canal es `firmas/server/otpDelivery.ts`, que imprime en la terminal del servidor una línea `[firma-otp-dev] Código 123456 · contrato … · firmante an***@… · vence …`.

- Solo funciona si coinciden `import.meta.env.DEV`, fijado al compilar, y `FIRMA_OTP_DEV_CONSOLE=true`. En una compilación de producción la variable no tiene efecto.
- Sin canal, `/api/firma/codigo` responde 503 `OTP_CHANNEL_UNAVAILABLE` sin generar ningún código, y la página avisa que la firma no se puede completar. **Por eso en producción todavía no se puede firmar.**
- El código es aleatorio, se verifica por HMAC y conserva las reglas de 07: vence en 10 minutos, admite 5 intentos, espera 60 s entre códigos y permite 5 por invitación. Nunca sale en una respuesta HTTP.
- El texto de consentimiento de 07 dice que el código «se enviará» al correo. Mientras no exista ese envío, la página aclara lo que ocurre en realidad, y una firma hecha así solo sirve como prueba.

## Rutas

Son `POST`, salvo donde se indica. Las del firmante llevan `Authorization: Bearer <token>`.

| Ruta | Función | RPC |
|---|---|---|
| `/api/firma/sesion` | Abre la invitación | `abrir_invitacion_firma` |
| `/api/firma/documento` | Entrega el PDF y registra la visualización | `abrir_invitacion_firma`, `registrar_visualizacion_firma` |
| `/api/firma/consentimiento` | Registra la aceptación | `registrar_consentimiento_firma` |
| `/api/firma/codigo` | Emite el código y lo entrega por el canal disponible | `abrir_invitacion_firma`, `emitir_otp_firma` |
| `/api/firma/firmar` | Firma y, si es la última, cierra | `abrir_invitacion_firma`, `firmar_documento_electronico` |
| `/api/admin/arrendamiento/contratos/[contratoId]/firmas/[procesoId]/invitaciones` | Genera la invitación y devuelve su enlace (sesión de administrador) | `emitir_invitacion_firma` |
| `GET` de la misma ruta | Estado de la última invitación de cada firmante, sin enlace ni token | `consultar_evidencia_firma` |

## Configuración externa

| Variable | Uso | Si falta |
|---|---|---|
| `FIRMA_OTP_SECRET` | Clave del HMAC de los códigos; mínimo 32 caracteres. Generar con `openssl rand -base64 48`. **Cambiarla invalida los códigos vigentes.** | No se emiten ni verifican códigos |
| `FIRMA_OTP_DEV_CONSOLE` | Solo en desarrollo, en `.env.development.local`: `true` imprime los códigos en la terminal. No configurar en producción, donde no tiene efecto | No hay canal de códigos |
| `PUBLIC_SITE_URL` | Base del enlace de las invitaciones. Debe ser la URL pública de producción | No se emiten invitaciones |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya existente | No funciona ninguna ruta |
| `CRON_SECRET` | Ya documentada: recuperación del PDF final | Sin recuperación programada |

Solo `PUBLIC_SITE_URL` se expone al navegador. Las demás deben configurarse como secretos del servidor.

El correo sigue siendo un dato obligatorio del firmante en 07, porque forma parte de la evidencia, aunque no se le envíe nada. Un firmante sin correo válido no puede recibir invitación.

## Comprobaciones pendientes en un entorno real

1. Instalar 07 y crear un proceso nuevo. Un proceso `MANUAL` existente debe cancelarse y reiniciarse.
2. Firmar desde un celular iOS y uno Android reales. Las pruebas usan Chromium con táctil emulado.
3. Revisar el límite de respuesta de Vercel frente al tamaño de los PDF de contrato, porque `/api/firma/documento` los entrega desde la función.

## Decisiones pendientes

0. **Canal real de códigos.** Antes de abrir la firma en producción hay que definir el proveedor. Como el administrador ahora ve el enlace, el código debe llegar por un canal al que solo tenga acceso el firmante; de lo contrario, quien administra podría completar ambos pasos. También hay que comparar el canal elegido con el texto de consentimiento.
1. **Texto de consentimiento.** `CONSENTIMIENTO_FES_V2` ya está en 07, pendiente de revisión jurídica. Ver `docs/firmas-2c-consentimiento-firma-dibujada.md`.
2. **Copia para el firmante.** Hoy solo el administrador puede descargar el PDF final, y el enlace del firmante deja de servir al firmar. Falta decidir si se le entrega una copia y cómo.
3. **Cambio de correo.** `cambiar_correo_firmante` existe en 07, pero no tiene ruta ni pantalla. Un firmante sin correo válido bloquea la invitación hasta que esto se implemente.
4. **Revocar y anular.** `revocar_invitacion_firma` y `anular_proceso_firma` tampoco tienen pantalla. Generar un enlace nuevo ya invalida el anterior.

## Comportamiento conocido

- Cada ruta que resuelve el token registra un evento `INVITACION_ABIERTA`, porque `abrir_invitacion_firma` es la única RPC que devuelve los datos necesarios. El historial tendrá varios por firmante; no significa que el enlace se abriera varias veces.
- Un enlace ya usado responde igual que uno vencido o inexistente, por diseño de 07. La página no puede confirmar a quien lo reabre que ya firmó.
- La IP sale de `x-real-ip` o `x-forwarded-for`, que Vercel fija. Fuera de Vercel esas cabeceras podrían falsificarse.
