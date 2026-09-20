/**
 * Configuração do captcha do fluxo administrativo.
 *
 * A site key é pública por natureza (vai no HTML do widget). A SECRET correspondente
 * é cadastrada no painel do Supabase, em Authentication → Attack Protection, e nunca
 * entra neste repositório nem no .env da aplicação.
 *
 * Sem site key, o widget não é renderizado e o fluxo segue sem captcha — útil em
 * desenvolvimento. Com site key, o token passa a ser obrigatório.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export const CAPTCHA_ENABLED = TURNSTILE_SITE_KEY.trim() !== "";
