"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { Field, buttonClass, inputClass } from "@/components/dashboard/ui";
import { AUTH_MESSAGES, IDLE_FORM_STATE } from "@/lib/auth/admin-auth";
import { enrollMfaAction, verifyMfaAction, type MfaEnrollment } from "@/modules/auth/actions";
import { FormMessage } from "./AuthCard";

function CodeForm({ factorId, submitLabel }: { factorId?: string; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(verifyMfaAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage status={state.status} message={state.message} />
      {factorId && <input type="hidden" name="factorId" value={factorId} />}

      <Field label="Código de verificação" htmlFor="code" hint="Os 6 dígitos exibidos no aplicativo autenticador.">
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

      <button type="submit" disabled={pending} className={buttonClass("primary", "w-full")}>
        {pending ? "Verificando…" : submitLabel}
      </button>
    </form>
  );
}

/**
 * Segundo fator TOTP.
 *
 * No modo "verify" a conta já tem um fator confirmado. No modo "enroll" o segredo é
 * gerado sob demanda e mostrado uma única vez, apenas o necessário para cadastrar o
 * aplicativo. Um código errado não eleva o AAL, então o painel continua bloqueado.
 */
export function MfaForm({ mode }: { mode: "enroll" | "verify" }) {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (mode === "verify") {
    return <CodeForm submitLabel="Verificar e entrar" />;
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage status={error ? "error" : "idle"} message={error} />
        <p className="text-sm text-muted-foreground">
          O acesso administrativo exige verificação em duas etapas. Gere o código de
          configuração e registre-o em um aplicativo autenticador.
        </p>
        <button
          type="button"
          disabled={pending}
          className={buttonClass("primary", "w-full")}
          onClick={() =>
            startTransition(async () => {
              const result = await enrollMfaAction();
              if (result.ok) {
                setEnrollment(result.enrollment);
                setError("");
              } else {
                setError(result.message || AUTH_MESSAGES.generic);
              }
            })
          }
        >
          {pending ? "Gerando…" : "Configurar verificação em duas etapas"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-md border border-border p-4">
        <Image
          src={enrollment.qrCode}
          alt="QR Code para configurar o aplicativo autenticador"
          width={180}
          height={180}
          unoptimized
        />
        <div className="w-full text-center">
          <p className="text-xs text-muted-foreground">Ou digite este código no aplicativo:</p>
          <code className="mt-1 block break-all rounded-sm bg-muted px-2 py-1 font-mono text-xs">
            {enrollment.secret}
          </code>
        </div>
      </div>

      <CodeForm factorId={enrollment.factorId} submitLabel="Confirmar e ativar" />
    </div>
  );
}
