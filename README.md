# ParkNow

App móvil (Expo SDK 55 + expo-router + Supabase) para reservar un puesto de parqueadero, navegar hasta él y entrar con un código QR.

## Desarrollo

```bash
cp .env.example .env   # y complétalo
npm install
npx expo run:android   # build de desarrollo (usa expo-dev-client, no Expo Go)
```

`npm run typecheck` revisa los tipos. `npm run icons` regenera los íconos y gráficos de la tienda (requiere Pillow).

## Configuración

- `app.json`: configuración estática (nombre, paquete `com.aldairmm24.parknow`, íconos, permisos).
- `app.config.ts`: añade la clave de Google Maps desde `GOOGLE_MAPS_API_KEY`.
- `eas.json`: perfiles `development`, `preview` (APK) y `production` (AAB para Play). Las variables de entorno de cada perfil se guardan en EAS (`npx eas-cli env:create`), no en este archivo.

## Estructura

- `app/`: pantallas (expo-router)
- `components/`, `theme/`: interfaz y sistema de diseño
- `services/`, `repositories/`, `domain/`: lógica y acceso a Supabase
- `supabase/schema.sql`: esquema y políticas RLS
- `store/`: material para la ficha de Google Play
