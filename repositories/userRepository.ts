import { supabase } from '@/lib/supabase';
import { User } from '@/domain/models';
import { AuthProvider, UserStatus } from '@/domain/enums';

export const userRepository = {
  /** Perfil por id. Devuelve `null` si aún no existe (no lanza). */
  async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapUser(data) : null;
  },

  /**
   * Inserta el perfil, o lo devuelve si otra petición se adelantó.
   *
   * Hay una carrera real: el trigger `handle_new_user` del esquema crea la fila
   * en el mismo instante en que la app intenta crearla. `upsert` con
   * `ignoreDuplicates` deja ganar a quien llegue primero.
   */
  async upsert(params: {
    id: string;
    fullName: string;
    phone: string;
    email: string;
    avatarUrl?: string;
    authProvider: AuthProvider;
    acceptedTermsAt?: string;
  }): Promise<User> {
    const { error } = await supabase
      .from('users')
      .upsert({
        id: params.id,
        full_name: params.fullName,
        phone: params.phone,
        email: params.email,
        avatar_url: params.avatarUrl ?? null,
        auth_provider: params.authProvider,
        accepted_terms_at: params.acceptedTermsAt ?? new Date().toISOString(),
      }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    const user = await this.getById(params.id);
    if (!user) throw new Error('No se pudo crear el perfil de usuario.');
    return user;
  },

  async update(id: string, patch: {
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
    marketingOptIn?: boolean;
  }): Promise<User> {
    const row: Record<string, unknown> = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    if (patch.marketingOptIn !== undefined) row.marketing_opt_in = patch.marketingOptIn;

    const { data, error } = await supabase
      .from('users')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapUser(data);
  },

  /** Marca la cuenta para borrado; el purgado real lo hace el backend. */
  async markForDeletion(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ deletion_requested_at: new Date().toISOString(), status: UserStatus.INACTIVE })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  /**
   * Exportación de los datos personales del usuario (derecho de acceso y
   * portabilidad: art. 15 y 20 del RGPD, art. 8 de la Ley 1581 de 2012).
   */
  async exportPersonalData(id: string): Promise<Record<string, unknown>> {
    const [profile, reservations, payments] = await Promise.all([
      supabase.from('users').select('*').eq('id', id).maybeSingle(),
      supabase.from('reservations').select('*').eq('owner_id', id),
      supabase.from('payments').select('*, reservations!inner(owner_id)').eq('reservations.owner_id', id),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: profile.data ?? null,
      reservations: reservations.data ?? [],
      payments: payments.data ?? [],
    };
  },
};

function mapUser(row: any): User {
  return {
    id: row.id,
    fullName: row.full_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    status: (row.status as UserStatus) ?? UserStatus.ACTIVE,
    createdAt: row.created_at,
    avatarUrl: row.avatar_url ?? undefined,
    authProvider: (row.auth_provider as AuthProvider) ?? AuthProvider.EMAIL,
    acceptedTermsAt: row.accepted_terms_at ?? undefined,
    marketingOptIn: row.marketing_opt_in ?? false,
    deletionRequestedAt: row.deletion_requested_at ?? undefined,
  };
}
