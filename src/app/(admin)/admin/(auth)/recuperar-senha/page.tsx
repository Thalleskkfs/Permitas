import Link from "next/link";
import { AuthCard } from "@/components/admin/AuthCard";
import { RecoveryForm } from "@/components/admin/RecoveryForm";

export default function RecuperarSenhaPage() {
  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe o e-mail da conta administrativa para receber as instruções."
      footer={
        <Link href="/admin/login" className="focus-ring underline hover:text-foreground">
          Voltar para o acesso
        </Link>
      }
    >
      <RecoveryForm />
    </AuthCard>
  );
}
