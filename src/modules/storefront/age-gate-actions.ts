"use server";

import { cookies, headers } from "next/headers";
import { buildAgeGateCookie, isSecureRequest } from "./age-gate";

/**
 * Grava a declaração de maioridade. Usada como `action` de um `<form>`: funciona sem
 * JavaScript (o POST volta com a página já sem o portão) e, com JavaScript, o próprio
 * componente esconde o portão na hora.
 */
export async function declareAdult(): Promise<void> {
  const headerList = await headers();
  const secure = isSecureRequest(headerList.get("x-forwarded-proto"), headerList.get("origin"));
  const { name, value, options } = buildAgeGateCookie(secure);
  (await cookies()).set(name, value, options);
}
