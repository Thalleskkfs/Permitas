/** Casca neutra das telas de acesso: sem identidade de loja, sem navegação. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col gap-6 rounded-md border border-border p-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** Mensagem de resultado. O texto vem pronto das políticas em lib/auth/admin-auth. */
export function FormMessage({ status, message }: { status: "idle" | "error" | "success"; message: string }) {
  if (status === "idle" || !message) return null;

  return (
    <p
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`rounded-md border px-3 py-2 text-sm ${
        status === "error"
          ? "border-border bg-muted text-foreground"
          : "border-dashed border-border text-muted-foreground"
      }`}
    >
      {message}
    </p>
  );
}
