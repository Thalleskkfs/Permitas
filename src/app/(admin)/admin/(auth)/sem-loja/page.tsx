import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/AuthCard";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { createClient } from "@/lib/supabase/server";

// Depende da sessão: nunca pré-renderizada.
export const dynamic = "force-dynamic";

/**
 * Conta autenticada sem vínculo com nenhuma loja. Estar autenticado não basta: o acesso
 * depende de membership, e vínculos são concedidos pela administração da plataforma.
 */
export default async function SemLojaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/admin/login");

  return (
    <AuthCard
      title="Sem acesso a lojas"
      description="Sua conta está autenticada, mas ainda não está vinculada a nenhuma loja."
    >
      <p className="text-sm text-muted-foreground">
        Peça ao responsável pela loja para incluir sua conta como membro. O vínculo é
        concedido pela administração, nunca solicitado por esta tela.
      </p>
      <SignOutButton label="Sair" />
    </AuthCard>
  );
}
