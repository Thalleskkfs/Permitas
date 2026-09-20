import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/AuthCard";
import { MfaForm } from "@/components/admin/MfaForm";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { createClient } from "@/lib/supabase/server";

// Depende da sessão: nunca pré-renderizada.
export const dynamic = "force-dynamic";

/**
 * Segundo fator. Decide no servidor entre confirmar um fator existente e cadastrar o
 * primeiro — é assim que a primeira conta administrativa habilita o MFA sem que exista
 * qualquer fluxo público de criação.
 */
export default async function MfaPage() {
  const supabase = await createClient();

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) redirect("/admin/login");

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal2") redirect("/admin");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = (factors?.totp ?? []).some((factor) => factor.status === "verified");

  return (
    <AuthCard
      title={hasVerifiedFactor ? "Verificação em duas etapas" : "Configurar segundo fator"}
      description={
        hasVerifiedFactor
          ? "Digite o código do seu aplicativo autenticador para concluir o acesso."
          : "O acesso administrativo exige verificação em duas etapas."
      }
      footer={<SignOutButton label="Usar outra conta" className="underline hover:text-foreground" />}
    >
      <MfaForm mode={hasVerifiedFactor ? "verify" : "enroll"} />
    </AuthCard>
  );
}
