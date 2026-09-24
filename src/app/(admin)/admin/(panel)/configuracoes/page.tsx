import { notFound } from "next/navigation";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { FormSection } from "@/components/dashboard/FormSection";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/dashboard/StatusBadge";
import { WhatsAppSettingsForm } from "@/components/dashboard/WhatsAppSettingsForm";
import { buttonClass } from "@/components/dashboard/ui";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { canEditStoreSettings } from "@/modules/settings/authorization";
import { getStoreSettings } from "@/modules/settings/queries";

export default async function ConfiguracoesPage() {
  // A loja vem da membership autenticada; nenhum id chega pela URL ou pelo formulário.
  const store = await requireCurrentStore();
  const settings = await getStoreSettings(store.storeId);
  if (!settings) notFound();

  // Cada deploy é uma loja no domínio próprio, sem prefixo de slug (ver storefront-paths.ts).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  return (
    <DashboardContainer className="flex flex-col gap-8">
      <PageHeader
        title="Configurações"
        description="Canal de atendimento da loja: para onde vão os pedidos da vitrine."
      />

      <FormSection title="Loja" description="Identificação da loja.">
        <dl className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Nome</dt>
            <dd className="text-sm font-medium">{settings.storeName}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Endereço da vitrine</dt>
            <dd className="text-sm font-medium">{siteUrl ?? "Não configurado"}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">Edição dos dados da loja: em breve.</p>
      </FormSection>

      <WhatsAppSettingsForm
        storeName={settings.storeName}
        initialNumber={settings.whatsappNumber}
        initialTemplate={settings.whatsappMessageTemplate}
        canEdit={canEditStoreSettings(store.role)}
      />

      <FormSection title="Segurança" description="Acesso ao painel da loja.">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Autenticação</span>
            <span className="text-xs text-muted-foreground">
              Acesso protegido por senha e verificação em duas etapas.
            </span>
          </div>
          <Badge tone="outline">Ativa</Badge>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled className={buttonClass("outline")}>
              Alterar senha
            </button>
            <button type="button" disabled className={buttonClass("outline")}>
              Convidar membro
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Alteração de senha e convites: em breve.</p>
        </div>
      </FormSection>
    </DashboardContainer>
  );
}
