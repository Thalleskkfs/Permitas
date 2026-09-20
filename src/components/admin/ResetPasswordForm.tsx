"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, buttonClass, inputClass } from "@/components/dashboard/ui";
import { IDLE_FORM_STATE } from "@/lib/auth/admin-auth";
import { updatePasswordAction } from "@/modules/auth/actions";
import { FormMessage } from "./AuthCard";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, IDLE_FORM_STATE);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage status={state.status} message={state.message} />
        <Link href="/admin/login" className={buttonClass("primary", "w-full")}>
          Ir para o acesso
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage status={state.status} message={state.message} />

      {/* Sem regra de senha própria: a política é a configurada no Supabase Auth. */}
      <Field label="Nova senha" htmlFor="password" hint="Precisa atender à política de segurança do projeto.">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </Field>

      <Field label="Confirmar nova senha" htmlFor="passwordConfirmation">
        <input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </Field>

      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
