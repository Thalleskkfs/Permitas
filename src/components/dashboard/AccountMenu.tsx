import { signOutAction } from "@/modules/auth/actions";
import type { AdminUser } from "@/types/dashboard";

/** Itens ainda sem destino. Sair é real e encerra a sessão do Supabase. */
const INERT_ITEMS = ["Meu perfil", "Preferências"];

/**
 * Menu de conta em <details>: abre sem JavaScript. Os itens são inertes — autenticação
 * e logout entram em etapa posterior.
 */
export function AccountMenu({
  user,
  align = "left",
  placement = "top",
}: {
  user: AdminUser;
  align?: "left" | "right";
  placement?: "top" | "bottom";
}) {
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <details className="group relative">
      <summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-md px-2 py-2 hover:bg-muted [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
        >
          {initials}
        </span>
        <span className="flex min-w-0 flex-col text-left">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.roleLabel}</span>
        </span>
      </summary>

      <div
        className={`absolute z-20 w-56 rounded-md border border-border bg-background p-1 shadow-sm ${
          placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
        } ${align === "right" ? "right-0" : "left-0"}`}
      >
        <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user.email}</p>
        <ul className="border-t border-border pt-1">
          {INERT_ITEMS.map((item) => (
            <li key={item}>
              <span
                aria-disabled="true"
                className="block cursor-not-allowed rounded-sm px-3 py-2 text-sm text-muted-foreground"
              >
                {item}
              </span>
            </li>
          ))}
          <li>
            <form action={signOutAction}>
              <button
                type="submit"
                className="focus-ring block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
              >
                Sair
              </button>
            </form>
          </li>
        </ul>
      </div>
    </details>
  );
}
