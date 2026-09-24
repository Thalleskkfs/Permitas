import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireAdminAccess } from "@/lib/auth/admin-guard";
import { getCurrentStore } from "@/lib/auth/current-store";
import { createClient } from "@/lib/supabase/server";
import type { AdminStore, AdminUser } from "@/types/dashboard";

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
 * O nome das lojas vem do banco, lido com a sessão do usuário: a RLS só devolve as
 * lojas de que ele é membro, e a lista não depende de nada vindo do navegador.
 */
export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const access = await requireAdminAccess();

  const user: AdminUser = {
    name: access.email?.split("@")[0] ?? "Administrador",
    email: access.email ?? "",
    roleLabel: access.memberships[0].role === "owner" ? "Proprietário" : "Editor",
  };

  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id, name, slug")
    .in(
      "id",
      access.memberships.map((membership) => membership.storeId),
    )
    .order("name");
  const stores: AdminStore[] = data ?? [];

  const context = await getCurrentStore();
  const store =
    stores.find((option) => context.status === "ok" && option.id === context.storeId) ??
    stores[0] ?? { id: "", name: "Loja", slug: "" };

  return (
    <DashboardShell store={store} stores={stores} user={user}>
      {children}
    </DashboardShell>
  );
}
