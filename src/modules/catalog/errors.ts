/**
 * Tradução dos erros do banco para mensagens do painel.
 *
 * Módulo sem dependências. O banco continua sendo a última barreira: quando uma
 * constraint ou policy recusa a operação, a mensagem sai daqui — nunca se tenta
 * contornar a recusa.
 */

export type ActionState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Record<string, string>;
};

export const IDLE_ACTION_STATE: ActionState = { status: "idle", message: "" };

export const actionError = (message: string, fieldErrors?: Record<string, string>): ActionState => ({
  status: "error",
  message,
  fieldErrors,
});

export const actionSuccess = (message: string): ActionState => ({ status: "success", message });

export const CATALOG_MESSAGES = {
  duplicateSlug: "Já existe um item com esse nome nesta loja. Use outro nome.",
  duplicateSku: "Já existe um item com esse SKU nesta loja.",
  crossStore: "O item selecionado não pertence a esta loja.",
  checkViolation: "Valor recusado pelas regras do catálogo.",
  notAllowed: "Você não tem permissão para esta ação.",
  notFound: "Item não encontrado nesta loja.",
  invalidInput: "Revise os campos destacados.",
  cycle: "A categoria não pode ser subcategoria dela mesma.",
  generic: "Não foi possível concluir a operação.",
} as const;

export type DatabaseErrorLike = {
  code?: string;
  message?: string;
} | null;

export function toCatalogErrorMessage(error: DatabaseErrorLike) {
  if (!error) return CATALOG_MESSAGES.generic;

  const message = error.message ?? "";

  switch (error.code) {
    case "23505":
      return /sku/i.test(message) ? CATALOG_MESSAGES.duplicateSku : CATALOG_MESSAGES.duplicateSlug;
    case "23503":
      return CATALOG_MESSAGES.crossStore;
    case "23514":
      return CATALOG_MESSAGES.checkViolation;
    case "42501":
      return CATALOG_MESSAGES.notAllowed;
    default:
      break;
  }

  if (/row-level security/i.test(message)) return CATALOG_MESSAGES.notAllowed;
  if (/ciclos/i.test(message)) return CATALOG_MESSAGES.cycle;
  return CATALOG_MESSAGES.generic;
}

/** Converte issues do zod em erros por campo, preservando a ordem do formulário. */
export function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
