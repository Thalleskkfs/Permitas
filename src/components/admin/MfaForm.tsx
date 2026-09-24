"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, buttonClass, inputClass } from "@/components/dashboard/ui";
import { AUTH_MESSAGES, IDLE_FORM_STATE } from "@/lib/auth/admin-auth";
import { enrollMfaAction, verifyMfaAction, type MfaEnrollment } from "@/modules/auth/actions";
import { FormMessage } from "./AuthCard";

/**
 * Endereço exibível para o QR code do Supabase.
 *
 * Ele chega como `data:image/svg+xml;utf-8,<svg ...>` com o SVG CRU (sem codificar) e
 * uma quebra de linha no fim. O `next/image` recusa esse valor e derruba a tela, e mesmo
 * numa `<img>` o SVG cru quebra em `#` ou `%`. Então o SVG é separado do prefixo,
 * aparado e codificado. Se já vier codificado (ou em base64), passa só aparado.
 */
function qrCodeSrc(raw: string) {
  const valor = raw.trim();
  const prefixo = /^data:image\/svg\+xml;[^,]*,/.exec(valor);
  if (!prefixo) return valor;
  const corpo = valor.slice(prefixo[0].length).trim();
  if (!corpo.startsWith("<")) return valor;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(corpo)}`;
}

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
          Gere o código de configuração e registre-o em um aplicativo autenticador, como
          Google Authenticator ou Authy.
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
        {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado na hora; não há o que otimizar */}
        <img
          src={qrCodeSrc(enrollment.qrCode)}
          alt="QR Code para configurar o aplicativo autenticador"
          width={180}
          height={180}
          className="rounded-sm bg-white p-2"
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
