import { ImageIcon } from "./icons";

/** Estilos compartilhados do painel, para as classes não se repetirem em cada tela. */

/** Miniatura neutra. Não há imagens reais de produto nesta etapa. */
export function ImagePlaceholder({ alt, className }: { alt: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-center justify-center rounded-md border border-border bg-muted text-muted-foreground ${
        className ?? "size-10"
      }`}
    >
      <ImageIcon className="size-4" />
    </div>
  );
}

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "border border-border text-foreground hover:bg-muted",
};

export function buttonClass(variant: ButtonVariant = "outline", extra?: string) {
  return [
    "focus-ring inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-40",
    VARIANTS[variant],
    extra ?? "",
  ].join(" ");
}

export const inputClass =
  "focus-ring w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Interruptor visual. Não altera nada fora do próprio formulário. */
export function ToggleField({
  label,
  description,
  name,
  defaultChecked,
  onChange,
}: {
  label: string;
  description?: string;
  name: string;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  // Só anexa o handler quando existe, para o componente continuar renderizável no servidor.
  const handleChange = onChange
    ? (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)
    : undefined;

  return (
    <label className="flex items-start justify-between gap-4 rounded-md border border-border p-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={handleChange}
        className="focus-ring mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
      />
    </label>
  );
}
