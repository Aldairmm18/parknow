import { Redirect } from 'expo-router';
import { useSession } from '@/hooks/useSession';

/**
 * Entrada de la app. El layout raíz ya redirige según la sesión; esto sólo
 * cubre el arranque en frío a `/`, antes de que ese efecto se ejecute.
 */
export default function Index() {
  const { session, loading } = useSession();
  if (loading) return null;
  return <Redirect href={session ? '/(tabs)' : '/(auth)/welcome'} />;
}
