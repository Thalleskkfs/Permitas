import type { createClient } from "@/lib/supabase/server";
import type { StoreRole } from "../../lib/auth/store-context.ts";
import {
  CATALOG_MESSAGES,
  actionError,
  toCatalogErrorMessage,
  toFieldErrors,
  type ActionState,
} from "../catalog/errors.ts";
import { canEditStoreSettings } from "./authorization.ts";
import {
  storeDescriptionInputSchema,
  storeSettingsInputSchema,
  type StoreDescriptionInput,
  type StoreSettingsInput,
} from "./schemas.ts";

/**
 * Gravação das configurações da loja, sem depender de Next nem de cookies.
 *
 * A Server Action (actions.ts) injeta a loja corrente e o cliente de SESSÃO; os testes
 * injetam um cliente que executa no Postgres com as migrations reais, sob RLS. A ordem é
 * a mesma de toda ação do painel:
 *   1. valida a entrada com zod;
 *   2. resolve a loja pela membership autenticada (nunca por store_id do formulário);
 *   3. confere o papel — só o owner grava, como nas policies;
 *   4. executa com o cliente de sessão, sob RLS, e confere as linhas afetadas.
 *
 * Nenhum service_role participa.
 */

export type SettingsClient = Awaited<ReturnType<typeof createClient>>;

export type SettingsActionState = ActionState & {
  /** Valores gravados, já normalizados, para o formulário exibir o que ficou salvo. */
  saved?: { whatsappNumber: string | null; whatsappMessageTemplate: string | null };
};

export const SETTINGS_MESSAGES = {
  saved: "Configurações salvas.",
  notAllowed: "Somente o proprietário da loja pode alterar estas configurações.",
  invalidInput: CATALOG_MESSAGES.invalidInput,
} as const;

export type SaveStoreSettingsDeps = {
  /** Loja resolvida pela membership autenticada. */
  getStore: () => Promise<{ storeId: string; role: StoreRole }>;
  /** Cliente de sessão (RLS). Só é criado depois de a entrada e o papel passarem. */
  getClient: () => Promise<SettingsClient>;
};

export type StoreSettingsFormValues = {
  whatsappNumber: string;
  whatsappMessageTemplate: string;
};

export async function saveStoreSettings(
  deps: SaveStoreSettingsDeps,
  values: StoreSettingsFormValues,
): Promise<SettingsActionState> {
  const parsed = storeSettingsInputSchema.safeParse(values);
  if (!parsed.success) {
    return actionError(SETTINGS_MESSAGES.invalidInput, toFieldErrors(parsed.error.issues));
  }

  const store = await deps.getStore();

  // Primeira barreira. As policies store_settings_*_owner são as que decidem de fato.
  if (!canEditStoreSettings(store.role)) return actionError(SETTINGS_MESSAGES.notAllowed);

  const supabase = await deps.getClient();
  const error = await writeSettings(supabase, store.storeId, parsed.data);
  if (error) return actionError(error);

  return {
    status: "success",
    message: SETTINGS_MESSAGES.saved,
    saved: {
      whatsappNumber: parsed.data.whatsappNumber,
      whatsappMessageTemplate: parsed.data.whatsappMessageTemplate,
    },
  };
}

/**
 * UPDATE e, se a loja ainda não tem linha, INSERT.
 *
 * Não usamos upsert: o ON CONFLICT DO UPDATE do PostgREST reescreveria store_id, coluna
 * sem privilégio de UPDATE. Quando a RLS recusa, o UPDATE não dá erro — só não devolve
 * linha —, e o INSERT seguinte é recusado pela policy (ou pela chave, se a linha existir
 * mas for invisível). Em nenhum caso a recusa vira sucesso.
 */
async function writeSettings(
  supabase: SettingsClient,
  storeId: string,
  input: StoreSettingsInput,
): Promise<string | null> {
  const values = {
    whatsapp_number: input.whatsappNumber,
    whatsapp_message_template: input.whatsappMessageTemplate,
  };

  const { data, error } = await supabase
    .from("store_settings")
    .update(values)
    .eq("store_id", storeId)
    .select("store_id");

  if (error) return toSettingsErrorMessage(error);
  if (data && data.length > 0) return null;

  const { error: insertError } = await supabase
    .from("store_settings")
    .insert({ store_id: storeId, ...values });

  return insertError ? toSettingsErrorMessage(insertError) : null;
}

export type StoreDescriptionActionState = ActionState & {
  saved?: { storeDescription: string | null };
};

/**
 * Descrição da loja (`stores.description`): o texto que vira `<meta description>` e o
 * resumo do cartão de prévia do WhatsApp/Instagram em toda página da vitrine. Tabela
 * diferente da do resto deste arquivo (`stores`, não `store_settings`), mas a mesma regra
 * de quem grava — só o owner, como toda configuração da loja.
 */
export async function saveStoreDescription(
  deps: SaveStoreSettingsDeps,
  values: StoreDescriptionInput,
): Promise<StoreDescriptionActionState> {
  const parsed = storeDescriptionInputSchema.safeParse(values);
  if (!parsed.success) {
    return actionError(SETTINGS_MESSAGES.invalidInput, toFieldErrors(parsed.error.issues));
  }

  const store = await deps.getStore();
  if (!canEditStoreSettings(store.role)) return actionError(SETTINGS_MESSAGES.notAllowed);

  const supabase = await deps.getClient();
  const { data, error } = await supabase
    .from("stores")
    .update({ description: parsed.data.storeDescription })
    .eq("id", store.storeId)
    .select("id");

  if (error) return actionError(toSettingsErrorMessage(error));
  // A policy stores_update_owner é quem decide de fato: sem linha afetada, ela recusou.
  if (!data || data.length === 0) return actionError(SETTINGS_MESSAGES.notAllowed);

  return {
    status: "success",
    message: SETTINGS_MESSAGES.saved,
    saved: { storeDescription: parsed.data.storeDescription },
  };
}

function toSettingsErrorMessage(error: { code?: string; message?: string }) {
  // Linha existente mas invisível (outra loja) chega como chave duplicada: é recusa.
  if (error.code === "23505" || error.code === "42501" || /row-level security/i.test(error.message ?? "")) {
    return SETTINGS_MESSAGES.notAllowed;
  }
  if (error.code === "23514") return "Valor recusado pelo banco. Revise o número e a mensagem.";
  return toCatalogErrorMessage(error);
}
