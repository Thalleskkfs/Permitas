"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DASHBOARD_NAV,
  DASHBOARD_NAV_SECONDARY,
  isNavItemActive,
  type DashboardNavItem,
} from "@/config/dashboard-nav";
import type { AdminStore, AdminUser } from "@/types/dashboard";
import { AccountMenu } from "./AccountMenu";
import { NavIcon, SwitchIcon } from "./icons";

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: DashboardNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isNavItemActive(item.href, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <NavIcon name={item.icon} className="size-4 shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardSidebar({
  store,
  stores,
  user,
  onNavigate,
}: {
  store: AdminStore;
  stores: AdminStore[];
  user: AdminUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Loja ativa. A troca entre lojas entra junto com autenticação. */}
      <div className="border-b border-border p-3">
        <details className="group relative">
          <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
              >
                {store.name.charAt(0)}
              </span>
              <span className="truncate text-sm font-semibold">{store.name}</span>
            </span>
            <SwitchIcon className="size-4 shrink-0 text-muted-foreground" />
          </summary>

          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-background p-1 shadow-sm">
            <ul>
              {stores.map((option) => (
                <li key={option.id}>
                  <span
                    aria-disabled="true"
                    aria-current={option.id === store.id ? "true" : undefined}
                    className={`block cursor-not-allowed rounded-sm px-3 py-2 text-sm ${
                      option.id === store.id ? "font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {option.name}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Troca de loja indisponível no momento.
            </p>
          </div>
        </details>
      </div>

      <nav aria-label="Painel" className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        <NavList items={DASHBOARD_NAV} pathname={pathname} onNavigate={onNavigate} />
        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          <NavList items={DASHBOARD_NAV_SECONDARY} pathname={pathname} onNavigate={onNavigate} />
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <AccountMenu user={user} />
      </div>
    </div>
  );
}
