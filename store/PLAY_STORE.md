# Publicar ParkNow en Google Play

> ParkNow y Finance son apps **separadas**: cuenta de Supabase distinta, paquete distinto (`com.aldairmm24.parknow`) y ficha distinta en Play Console. Nada de este archivo se ejecuta en el proyecto de Finance.

## 0. Bloqueos antes de pasar a producción

Para la **prueba interna o cerrada** no hacen falta. Para **producción**, sí:

1. **Supabase propio.** Proyecto creado el 2026-10-17 (`ldmpqkzgehadtudsktqa`) y `.env` actualizado. Falta: pegar `supabase/setup_parknow.sql` en su SQL Editor y cargar la URL y la anon key en EAS.
2. **El pago es simulado.** "Confirmar y pagar" guarda la reserva con el pago marcado como exitoso, sin cobrar. Los Términos hablan de una pasarela de pagos y de reembolsos. Antes de producción hay dos caminos:
   - integrar una pasarela real (Wompi, Mercado Pago o PayU; al ser un servicio físico **no** se usa la facturación de Google Play), o
   - cambiar el botón a "Confirmar reserva" y la sección 5 de los Términos a "pago en el parqueadero".
3. ~~**Parqueaderos reales.**~~ Resuelto el 2026-10-17: el seed usa "ParkNow Demo Poblado / Las Lomas / Laureles" en vez de nombres de centros comerciales reales.
4. **Cupos que se acaban.** `schema.sql` genera horarios solo para los 7 días siguientes a cuando se ejecuta. Después la app no muestra disponibilidad. Hay que regenerarlos a diario (pg_cron en Supabase).
5. **Google Maps.** Sin `GOOGLE_MAPS_API_KEY` en EAS el mapa sale en blanco en Android.

## 1. Antes de la primera build

1. ~~`npx eas-cli init`~~ Hecho el 2026-10-17: `@aldair_dev_google/parknow`.
2. Variables en EAS, para `preview` y `production`:
   ```bash
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "<url>" --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>" --visibility plaintext
   npx eas-cli env:create --environment production --name GOOGLE_MAPS_API_KEY --value "<clave>" --visibility sensitive
   ```
3. **Páginas legales:** sube PARK a un repositorio de GitHub llamado `parknow` y activa Pages desde `docs/` → https://aldairmm18.github.io/parknow/privacy-policy.html y https://aldairmm18.github.io/parknow/delete-account.html. Si cambias `constants/legal.ts`, ejecuta `npm run legal`.
4. **Inicio de sesión con Google y Apple:** confírmalos en Supabase → Authentication → Providers. Un botón que falla es motivo de rechazo. Facebook se quitó el 2026-10-22 porque no estaba configurado; para volver a ofrecerlo, actívalo en Supabase, añade el botón en `components/auth/SocialAuthButtons.tsx` y nómbralo en `constants/legal.ts`.

## 2. Build y envío

```bash
npx eas-cli build --platform android --profile preview      # APK para probar en tu teléfono
npx eas-cli build --platform android --profile production   # AAB para Play
```

- La **primera** subida del AAB a Play Console debe ser **manual** (Prueba interna → Crear versión).
- Después puedes usar `npx eas-cli submit --platform android --profile production`.
- EAS crea y guarda la llave de firma. Activa **Play App Signing** y copia su **SHA-1** (Play Console → Integridad de la app) en la restricción de la clave de Google Maps.
- Las cuentas personales nuevas de Play deben hacer una **prueba cerrada con 12 testers durante 14 días** antes de publicar en producción.

## 3. Ficha de la tienda

**Nombre (30):** ParkNow: reserva parqueadero

**Descripción breve (80):** Reserva tu puesto de parqueadero, llega con ruta y entra con un código QR.

**Descripción completa:**

> ParkNow te ahorra dar vueltas buscando dónde parquear.
>
> ENCUENTRA PARQUEADERO CERCA
> Mira en el mapa los parqueaderos a tu alrededor, cuántos cupos les quedan y cuánto cuesta cada media hora.
>
> ELIGE TU PUESTO
> Escoge el horario por bloques de 30 minutos y, si quieres, tu espacio exacto en el plano del parqueadero. Para carro o moto.
>
> LLEGA SIN PERDERTE
> Sigue la ruta hasta la entrada. La app te avisa cuando llegas.
>
> ENTRA CON UN QR
> Tu reserva genera un código QR para la entrada. Sin tiquetes de papel.
>
> TUS DATOS, BAJO TU CONTROL
> Modo claro y oscuro. Descarga tus datos o elimina tu cuenta cuando quieras desde Perfil › Privacidad y datos.

**Categoría:** Mapas y navegación · **Etiquetas:** parqueadero, estacionamiento

**Gráficos** (en esta carpeta):
- Ícono 512×512: `play-icon-512.png`
- Gráfico destacado 1024×500: `feature-graphic-1024x500.png`
- Capturas de teléfono (1080×2160, en `store/screenshots/`): `01-inicio`, `02-detalle`, `03-horarios`, `04-puesto`, `05-confirmar`, `06-codigo-qr`, `07-reservas`, `08-modo-oscuro`. Tomadas en el emulador con la barra de estado en modo demo.

Los íconos y el gráfico son provisionales (una "P" sobre el violeta de marca). Si haces un logo, `npm run icons` los regenera desde `store/make_icons.py`.

## 4. Contenido de la app (Play Console → Política)

| Sección | Respuesta |
|---|---|
| Política de privacidad | URL de `privacy-policy.html` |
| Acceso a la app | "Se requiere inicio de sesión". Crea la cuenta de revisión (ver sección 6) y pon su correo y contraseña |
| Anuncios | No contiene anuncios |
| Clasificación de contenido | Cuestionario IARC: utilidad, sin violencia, sin apuestas, sin contenido generado por usuarios. Si integras pagos, marca "compras de bienes físicos o servicios". Resultado esperado: Apto para todos |
| Público objetivo | 18 años o más (los Términos lo exigen) |
| App financiera | No |
| App de salud | No |
| Eliminación de cuenta | Sí, desde la app. URL de `delete-account.html` |
| Permisos de ubicación | Solo en primer plano. No requiere declaración de ubicación en segundo plano |

### Seguridad de los datos

- **¿Recopila o comparte datos?** Recopila sí. Comparte: la placa y el horario con el operador del parqueadero, que es lo que dice la Política de Privacidad.
- **¿Cifrados en tránsito?** Sí (HTTPS).
- **¿El usuario puede pedir la eliminación?** Sí.

| Tipo de dato | Recopilado | Compartido | Obligatorio | Uso |
|---|---|---|---|---|
| Nombre | Sí | Sí (operador) | Sí | Gestión de la cuenta, funcionalidad |
| Correo electrónico | Sí | No | Sí | Gestión de la cuenta |
| Número de teléfono | Sí | No | Sí | Gestión de la cuenta |
| ID de usuario | Sí | No | Sí | Gestión de la cuenta |
| Ubicación aproximada | Sí | No | No | Funcionalidad (parqueaderos cercanos) |
| Ubicación precisa | Sí | No | No | Funcionalidad (ruta hasta el parqueadero) |
| Fotos y videos | No (la cámara solo lee el QR, no guarda imágenes) | — | — | — |
| Actividad en la app → otras acciones (reservas, placa del vehículo) | Sí | Sí (operador) | Sí | Funcionalidad |
| Información financiera → historial de compras | Solo si integras una pasarela real | — | — | — |

Ubicación: la "ruta" con Google Directions solo envía el origen y el destino del trayecto. Si configuras `EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY`, decláralo como compartido con Google para "Funcionalidad".

## 5. Notas técnicas

- `app.json` pide solo cámara, ubicación (solo en primer plano) y vibración. Bloquea el micrófono, la ubicación en segundo plano, el almacenamiento y la superposición sobre otras apps.
- EAS incrementa el `versionCode` en cada build de producción (`appVersionSource: remote`). Cuando cambies funciones visibles, sube `version` en `app.json`.

## 6. Cuenta de revisión

1. Crea desde la app la cuenta `parknow.revisiondev@gmail.com` (o el correo que prefieras; cámbialo también en el script).
2. En el SQL Editor del proyecto de **ParkNow**, ejecuta `store/seed_review_account.sql`. Crea una reserva próxima con su QR y una ya terminada, para que el revisor vea la app con datos.
3. En Play Console → Acceso a la app, pon el correo, la contraseña y esta nota: "Abre la pestaña Reservas para ver una reserva activa con su código QR. Para reservar, elige un parqueadero en el mapa."
