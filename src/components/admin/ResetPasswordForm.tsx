"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field, buttonClass, inputClass } from "@/components/dashboard/ui";
import { IDLE_FORM_STATE } from "@/lib/auth/admin-auth";
import { exchangeRecoveryCodeAction, updatePasswordAction } from "@/modules/auth/actions";
import { FormMessage } from "./AuthCard";

type Etapa = "validando" | "invalido" | "pronto";

/**
 * Nova senha a partir do link do e-mail. Primeiro o código do link vira sessão (e sai da
 * barra de endereço, para não ser reaproveitado); com o segundo fator ativo, o formulário
 * pede também o código do autenticador.
 */
export function ResetPasswordForm({ code }: { code: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePasswordAction, IDLE_FORM_STATE);
  const [etapa, setEtapa] = useState<Etapa>(code ? "validando" : "pronto");
  const [pedeCodigo, setPedeCodigo] = useState(false);
  const trocado = useRef(false);

  useEffect(() => {
    if (!code || trocado.current) return;
    trocado.current = true;
    exchangeRecoveryCodeAction(code).then((resultado) => {
      if (resultado.ok) {
        setPedeCodigo(resultado.needsMfaCode);
        setEtapa("pronto");
      } else {
        setEtapa("invalido");
      }
      router.replace("/admin/redefinir-senha");
    });
  }, [code, router]);

  if (etapa === "validando") {
    return <p className="text-sm text-muted-foreground">Validando o link…</p>;
  }

  if (etapa === "invalido") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage
          status="error"
          message="Este link expirou ou já foi usado. Peça um novo no mesmo navegador em que vai abrir o e-mail."
        />
        <Link href="/admin/recuperar-senha" className={buttonClass("primary", "w-full")}>
          Pedir um novo link
        </Link>
      </div>
    );
  }

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

      {pedeCodigo && (
        <Field label="Código do autenticador" htmlFor="code" hint="Os 6 dígitos do aplicativo autenticador.">
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            className={`${inputClass} text-center text-lg tracking-[0.4em] tabular-nums`}
          />
        </Field>
      )}

      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
