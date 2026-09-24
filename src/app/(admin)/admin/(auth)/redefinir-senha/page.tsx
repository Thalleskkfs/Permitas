import { AuthCard } from "@/components/admin/AuthCard";
import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";

export default async function RedefinirSenhaPage({ searchParams }: PageProps<"/admin/redefinir-senha">) {
  const { code } = await searchParams;
  return (
    <AuthCard
      title="Definir nova senha"
      description="Abra esta página pelo link enviado por e-mail."
      footer="Redefinir a senha não desativa a verificação em duas etapas."
    >
      <ResetPasswordForm code={typeof code === "string" ? code : ""} />
    </AuthCard>
  );
}
