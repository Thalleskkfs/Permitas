"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, buttonClass, inputClass } from "@/components/dashboard/ui";
import { IDLE_FORM_STATE } from "@/lib/auth/admin-auth";
import { signInAction } from "@/modules/auth/actions";
import { CaptchaField } from "./CaptchaField";
import { FormMessage } from "./AuthCard";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage status={state.status} message={state.message} />

      <Field label="E-mail" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={inputClass}
        />
      </Field>

      <Field label="Senha" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>

      <CaptchaField />

      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Entrando…" : "Entrar"}
      </button>

      <Link
        href="/admin/recuperar-senha"
        className="focus-ring text-center text-sm text-muted-foreground underline hover:text-foreground"
      >
        Esqueci minha senha
      </Link>
    </form>
  );
}
