import { AuthCard } from "@/components/admin/AuthCard";
import { LoginForm } from "@/components/admin/LoginForm";

export default function LoginPage() {
  return (
    <AuthCard
      title="Entrar"
      description="Acesso restrito à administração da loja."
      footer="O acesso é criado pela administração da plataforma. Não há cadastro público."
    >
      <LoginForm />
    </AuthCard>
  );
}
