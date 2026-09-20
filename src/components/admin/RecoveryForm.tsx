"use client";

import { useActionState } from "react";
import { Field, buttonClass, inputClass } from "@/components/dashboard/ui";
import { IDLE_FORM_STATE } from "@/lib/auth/admin-auth";
import { requestPasswordResetAction } from "@/modules/auth/actions";
import { CaptchaField } from "./CaptchaField";
import { FormMessage } from "./AuthCard";

export function RecoveryForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage status={state.status} message={state.message} />

      <Field label="E-mail" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
      </Field>

      <CaptchaField />

      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Enviando…" : "Enviar instruções"}
      </button>
    </form>
  );
}
