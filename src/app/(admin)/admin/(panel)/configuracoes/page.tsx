import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { FormSection } from "@/components/dashboard/FormSection";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { Badge } from "@/components/dashboard/StatusBadge";
import { Field, ToggleField, buttonClass, inputClass } from "@/components/dashboard/ui";
import { getStore } from "@/modules/dashboard/mock";

export default function ConfiguracoesPage() {
  const store = getStore();

  return (
    <DashboardContainer className="flex flex-col gap-8">
      <PageHeader
        title="Configurações"
        description="Dados da loja, canal de atendimento e preferências."
      />

      <SettingsForm>
        <FormSection title="Dados da loja" description="Identificação usada na loja e nos contatos.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nome da loja" htmlFor="store-name">
              <input id="store-name" name="storeName" defaultValue={store.name} className={inputClass} />
            </Field>
            <Field label="Identificador" htmlFor="store-slug" hint="Usado no endereço da loja.">
              <input id="store-slug" name="storeSlug" defaultValue={store.slug} className={inputClass} />
            </Field>
          </div>
          <Field label="Descrição" htmlFor="store-description">
            <textarea id="store-description" name="storeDescription" rows={3} className={inputClass} />
          </Field>
        </FormSection>

        <FormSection
          title="WhatsApp"
          description="Número que recebe as solicitações e a mensagem enviada pelo cliente."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Número" htmlFor="whatsapp-number" hint="Formato internacional, ex.: +55 11 99999-9999.">
              <input id="whatsapp-number" name="whatsappNumber" placeholder="+55 11 99999-9999" className={inputClass} />
            </Field>
          </div>
          <Field
            label="Mensagem padrão"
            htmlFor="whatsapp-template"
            hint="Use {itens} e {total} para inserir o conteúdo da solicitação."
          >
            <textarea
              id="whatsapp-template"
              name="whatsappTemplate"
              rows={3}
              defaultValue="Olá! Tenho interesse em: {itens}. Total estimado: {total}."
              className={inputClass}
            />
          </Field>
        </FormSection>

        <FormSection title="Domínio" description="Endereço onde a loja fica disponível.">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{store.slug}.exemplo.com</span>
              <span className="text-xs text-muted-foreground">Subdomínio padrão</span>
            </div>
            <Badge tone="outline">Ativo</Badge>
          </div>
          <Field label="Domínio próprio" htmlFor="custom-domain" hint="Verificação de domínio indisponível no momento.">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="custom-domain" name="customDomain" placeholder="www.sualoja.com.br" className={inputClass} />
              <button type="button" className={buttonClass("outline", "sm:w-auto")}>
                Verificar
              </button>
            </div>
          </Field>
        </FormSection>

        <FormSection title="Preferências" description="Comportamentos gerais da loja.">
          <ToggleField
            name="showOutOfStock"
            label="Exibir produtos sem estoque"
            description="Produtos esgotados continuam visíveis, marcados como indisponíveis."
            defaultChecked
          />
          <ToggleField
            name="showPrices"
            label="Exibir preços no catálogo"
            description="Desligue para negociar todos os valores pelo WhatsApp."
            defaultChecked
          />
          <ToggleField
            name="lowStockAlert"
            label="Avisar sobre baixo estoque"
            description="Destaca no painel os itens com poucas unidades."
            defaultChecked
          />
        </FormSection>

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
            <p className="text-xs text-muted-foreground">
              Alteração de senha e convites indisponíveis no momento.
            </p>
          </div>
        </FormSection>
      </SettingsForm>
    </DashboardContainer>
  );
}
