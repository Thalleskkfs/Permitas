"use client";

import { useState } from "react";
import { buttonClass } from "./ui";

/**
 * Casca das telas de configuração. Intercepta o submit: nada é salvo nesta etapa.
 * Trocar por `action={...}` liga o formulário a uma Server Action sem mexer nos campos.
 */
export function SettingsForm({
  submitLabel = "Salvar alterações",
  children,
}: {
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
      className="flex flex-col gap-8"
    >
      {children}

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {submitted
            ? "Salvamento indisponível no momento."
            : "Estas configurações ainda não podem ser salvas."}
        </p>
        <button type="submit" className={buttonClass("primary")}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
