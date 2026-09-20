import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/AuthCard";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { getCurrentStore } from "@/lib/auth/current-store";

export const dynamic = "force-dynamic";

/**
 * Conta vinculada a mais de uma loja.
 *
 * A troca de loja é uma etapa futura. Em vez de escolher uma por conta própria — o que
 * poderia levar alguém a editar o catálogo errado — o painel para aqui e explica.
 */
export default async function SelecionarLojaPage() {
  const context = await getCurrentStore();
  if (context.status === "ok") redirect("/admin");
  if (context.status === "no-store") redirect("/admin/sem-loja");

  return (
    <AuthCard
      title="Selecione uma loja"
      description={`Sua conta está vinculada a ${context.memberships.length} lojas.`}
    >
      <p className="text-sm text-muted-foreground">
        A troca entre lojas ainda não está disponível. Enquanto isso, o painel não escolhe
        uma loja automaticamente para evitar que o catálogo errado seja editado.
      </p>
      <SignOutButton label="Sair" />
    </AuthCard>
  );
}
