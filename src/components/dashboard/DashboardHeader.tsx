"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { resolveDashboardCrumbs, resolveDashboardTitle } from "@/config/dashboard-nav";
import type { AdminUser } from "@/types/dashboard";
import { AccountMenu } from "./AccountMenu";
import { SearchInput } from "./SearchInput";
import { MenuIcon } from "./icons";
import { buttonClass } from "./ui";

export function DashboardHeader({ user, onOpenMenu }: { user: AdminUser; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const crumbs = resolveDashboardCrumbs(pathname);
  // Busca global: visual nesta etapa, será ligada quando houver dados reais.
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className={buttonClass("ghost", "px-2 lg:hidden")}
        >
          <MenuIcon className="size-5" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          <nav aria-label="Breadcrumb" className="hidden sm:block">
            <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {crumb.href ? (
                    <Link href={crumb.href} className="focus-ring hover:text-foreground hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                  {index < crumbs.length - 1 && <span aria-hidden="true">/</span>}
                </li>
              ))}
            </ol>
          </nav>
          <p className="truncate text-sm font-semibold">{resolveDashboardTitle(pathname)}</p>
        </div>

        <div className="hidden md:block">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar no painel"
            label="Buscar no painel"
          />
        </div>

        <div className="shrink-0">
          <AccountMenu user={user} align="right" placement="bottom" />
        </div>
      </div>
    </header>
  );
}
