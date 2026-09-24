import type { StoreRole } from "../../lib/auth/store-context.ts";

/**
 * Quem pode alterar as configurações da loja, do lado da aplicação.
 *
 * Espelha exatamente as policies de store_settings (migration da fundação da loja):
 *   * store_settings_select_member — qualquer membro (owner ou editor) lê;
 *   * store_settings_insert_owner / store_settings_update_owner — só o owner grava.
 *
 * É a primeira barreira, não a única: a RLS decide de fato em cada consulta.
 */
export type SettingsAction = "settings:read" | "settings:update";

const ROLE_ACTIONS: Record<StoreRole, readonly SettingsAction[]> = {
  owner: ["settings:read", "settings:update"],
  editor: ["settings:read"],
};

export function settingsRoleAllows(role: StoreRole, action: SettingsAction) {
  return ROLE_ACTIONS[role].includes(action);
}

export function canEditStoreSettings(role: StoreRole) {
  return settingsRoleAllows(role, "settings:update");
}
