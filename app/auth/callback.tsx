import { Redirect } from 'expo-router';

/**
 * Destino de `parknow://auth/callback`, la URL a la que vuelve el proveedor
 * OAuth (hoy, Google) tras el consentimiento. El canje del código lo hace
 * `authService.signInWithProvider` con la URL que recibe el navegador; esta
 * ruta sólo existe para que expo-router no muestre "Unmatched Route" cuando
 * el sistema también entrega el enlace a la app.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
