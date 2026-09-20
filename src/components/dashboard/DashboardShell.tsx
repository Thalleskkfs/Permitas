"use client";

import { useEffect, useState } from "react";
import type { AdminStore, AdminUser } from "@/types/dashboard";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import { CloseIcon } from "./icons";
import { buttonClass } from "./ui";

/**
 * Estrutura do painel: sidebar fixa no desktop e gaveta no mobile.
 * Só existe para guardar o estado do menu; o conteúdo continua renderizado no servidor.
 */
export function DashboardShell({
  store,
  stores,
  user,
  children,
}: {
  store: AdminStore;
  stores: AdminStore[];
  user: AdminUser;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <div className="sticky top-0 h-dvh">
          <DashboardSidebar store={store} stores={stores} user={user} />
        </div>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 size-full bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
                className={buttonClass("ghost", "px-2")}
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <DashboardSidebar
                store={store}
                stores={stores}
                user={user}
                onNavigate={() => setMenuOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader user={user} onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
