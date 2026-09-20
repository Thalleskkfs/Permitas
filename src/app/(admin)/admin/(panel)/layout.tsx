import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireAdminAccess } from "@/lib/auth/admin-guard";
import { getStore, getStores } from "@/modules/dashboard/mock";
import type { AdminUser } from "@/types/dashboard";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

// Área autenticada: nunca pré-renderizada nem servida de cache.
export const dynamic = "force-dynamic";

/**
 * Layout protegido: toda rota abaixo de /admin (fora das telas de acesso) passa por aqui.
 *
 * A proteção é server-side e roda antes de qualquer conteúdo ser renderizado. Sem sessão
 * válida, sem AAL2 ou sem vínculo com loja, o guarda redireciona e o painel nunca é
 * produzido.
 *
 * Os dados do catálogo continuam vindo dos mocks; apenas a identidade é real.
 */
export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const access = await requireAdminAccess();

  const user: AdminUser = {
    name: access.email?.split("@")[0] ?? "Administrador",
    email: access.email ?? "",
    roleLabel: access.memberships[0].role === "owner" ? "Proprietário" : "Editor",
  };

  return (
    <DashboardShell store={getStore()} stores={getStores()} user={user}>
      {children}
    </DashboardShell>
  );
}
