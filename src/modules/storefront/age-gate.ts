/**
 * Portão de idade da vitrine: nome, valor e atributos do cookie de declaração.
 *
 * É uma declaração ("tenho 18 anos ou mais"), não uma verificação de documento. Este
 * módulo é puro (sem `next/*`) para que a decisão de mostrar o portão e o formato do
 * cookie possam ser testados fora do Next.
 */

export const AGE_GATE_COOKIE = "idade_declarada";

/** Único valor aceito como declaração feita. Qualquer outro conta como não declarado. */
export const AGE_GATE_VALUE = "1";

/** 30 dias, em segundos. */
export const AGE_GATE_MAX_AGE = 60 * 60 * 24 * 30;

/** Mostrar o portão? Só não mostra quando o cookie tem exatamente o valor esperado. */
export function shouldShowAgeGate(cookieValue: string | undefined | null): boolean {
  return cookieValue !== AGE_GATE_VALUE;
}

/**
 * A requisição chegou por HTTPS? Atrás de proxy vale o primeiro valor de
 * `x-forwarded-proto`; sem ele, o esquema da origem.
 */
export function isSecureRequest(forwardedProto: string | null, origin: string | null): boolean {
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (proto) return proto === "https";
  return origin?.toLowerCase().startsWith("https:") ?? false;
}

/** Cookie gravado quando a pessoa declara ter 18 anos ou mais. */
export function buildAgeGateCookie(secure: boolean) {
  return {
    name: AGE_GATE_COOKIE,
    value: AGE_GATE_VALUE,
    options: {
      path: "/",
      maxAge: AGE_GATE_MAX_AGE,
      sameSite: "lax" as const,
      secure,
    },
  };
}
