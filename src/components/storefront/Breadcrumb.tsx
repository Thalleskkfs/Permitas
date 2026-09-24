import Link from "next/link";
import { ChevronRightIcon } from "./icons";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

// Link de texto da direção: sublinhado fixo em tom de contorno (no celular não há hover
// para revelar que é link) que passa ao rosé no hover. Só cor muda, em 220ms.
const LINK =
  "focus-ring -mx-1.5 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-1.5 underline decoration-control-border underline-offset-4 transition-[color,text-decoration-color] duration-(--duracao-estado) ease-(--ease-saida) hover:text-foreground hover:decoration-accent";

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm text-muted-foreground">
      <ol className="-my-2 flex flex-wrap items-center gap-x-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex min-h-11 min-w-0 items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className={LINK}>
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "text-pretty text-foreground" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRightIcon className="size-3.5 shrink-0 opacity-70" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
